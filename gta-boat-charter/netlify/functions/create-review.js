const { requireAuth } = require("./_auth");
const { handleOptions, json } = require("./_responses");

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return 0;
}

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const authResult = await requireAuth(event);
  if (!authResult.ok) return authResult.response;

  try {
    const { decodedToken, db, admin } = authResult;
    const { boatId, stars, text } = JSON.parse(event.body || "{}");
    const normalizedStars = Number(stars);
    const normalizedText = String(text || "").trim();

    if (!boatId) {
      return json(400, { error: "boatId is required." });
    }

    if (!Number.isInteger(normalizedStars) || normalizedStars < 1 || normalizedStars > 5) {
      return json(400, { error: "Rating must be an integer between 1 and 5." });
    }

    const [boatSnapshot, userSnapshot, bookingsSnapshot, existingReviewsSnapshot] = await Promise.all([
      db.collection("boats").doc(String(boatId)).get(),
      db.collection("users").doc(decodedToken.uid).get(),
      db.collection("bookings").where("userId", "==", decodedToken.uid).where("boatId", "==", String(boatId)).get(),
      db.collection("reviews").where("userId", "==", decodedToken.uid).where("boatId", "==", String(boatId)).get(),
    ]);

    if (!boatSnapshot.exists) {
      return json(404, { error: "Listing no longer exists." });
    }

    const boat = boatSnapshot.data();
    if (boat?.ownerId === decodedToken.uid) {
      return json(403, { error: "Owners cannot review their own listing." });
    }

    const legacyBoatReview = existingReviewsSnapshot.docs.find((reviewDoc) => !reviewDoc.data()?.bookingId);
    if (legacyBoatReview) {
      return json(409, { error: "You've already reviewed this charter." });
    }

    const reviewedBookingIds = new Set(
      existingReviewsSnapshot.docs
        .map((reviewDoc) => String(reviewDoc.data()?.bookingId || ""))
        .filter(Boolean)
    );

    const eligibleBooking = bookingsSnapshot.docs
      .map((bookingDoc) => ({ id: bookingDoc.id, ...bookingDoc.data() }))
      .filter((booking) => booking.status === "confirmed")
      .filter((booking) => !reviewedBookingIds.has(booking.id))
      .sort((left, right) => {
        const leftTime = toMillis(left.bookingConfirmedAt) || toMillis(left.updatedAt) || toMillis(left.createdAt);
        const rightTime = toMillis(right.bookingConfirmedAt) || toMillis(right.updatedAt) || toMillis(right.createdAt);
        return rightTime - leftTime;
      })[0];

    if (!eligibleBooking) {
      return json(403, { error: "You can only review a charter after a confirmed booking that has not already been reviewed." });
    }

    const reviewId = `${eligibleBooking.id}__${decodedToken.uid}`;
    const reviewRef = db.collection("reviews").doc(reviewId);
    const reviewSnapshot = await reviewRef.get();
    if (reviewSnapshot.exists) {
      return json(409, { error: "You've already reviewed this booking." });
    }

    const userProfile = userSnapshot.exists ? userSnapshot.data() : {};

    await reviewRef.set({
      bookingId: eligibleBooking.id,
      bookingReference: eligibleBooking.bookingReference || "",
      boatId: String(boatId),
      boatName: boat?.name || "",
      ownerId: boat?.ownerId || "",
      userId: decodedToken.uid,
      userName: userProfile?.displayName || decodedToken.name || decodedToken.email || "User",
      stars: normalizedStars,
      text: normalizedText,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const allReviewsSnapshot = await db.collection("reviews").where("boatId", "==", String(boatId)).get();
    let total = 0;
    let count = 0;

    allReviewsSnapshot.forEach((item) => {
      const score = Number(item.data()?.stars || 0);
      if (score >= 1 && score <= 5) {
        total += score;
        count += 1;
      }
    });

    const average = count ? Math.round((total / count) * 10) / 10 : 0;

    await db.collection("boats").doc(String(boatId)).set(
      {
        rating: average,
        reviews: count,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return json(200, {
      ok: true,
      reviewId,
      bookingId: eligibleBooking.id,
      rating: average,
      reviews: count,
    });
  } catch (error) {
    console.error("create-review error:", error);
    return json(500, { error: error.message || "Unable to submit review." });
  }
};
