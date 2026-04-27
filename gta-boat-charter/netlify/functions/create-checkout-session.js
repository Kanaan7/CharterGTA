const { requireAuth } = require("./_auth");
const { getStripe } = require("./_stripe");
const { handleOptions, json } = require("./_responses");
const {
  buildCheckoutMetadata,
  buildDestinationCharge,
  reserveBookingCheckout,
  validateCheckoutPayload,
} = require("./_marketplace");

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
    const body = JSON.parse(event.body || "{}");
    const { boatId, date, slot } = body;

    if (!boatId || !date || !slot) {
      return json(400, { error: "boatId, date, and slot are required." });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return json(500, { error: "Missing NEXT_PUBLIC_APP_URL env var." });
    }

    const [boatSnapshot, userSnapshot] = await Promise.all([
      db.collection("boats").doc(String(boatId)).get(),
      db.collection("users").doc(decodedToken.uid).get(),
    ]);

    const currentUserProfile = userSnapshot.exists ? userSnapshot.data() : {};
    const validation = validateCheckoutPayload({
      boat: boatSnapshot,
      boatId: String(boatId),
      date,
      slot,
      passengerUser: { ...currentUserProfile, uid: decodedToken.uid },
    });

    if (!validation.ok) {
      return json(400, { error: validation.error });
    }

    const boatData = {
      id: boatSnapshot.id,
      ...validation.boatData,
    };

    const reservation = await reserveBookingCheckout({
      admin,
      db,
      boatId: boatSnapshot.id,
      date: validation.normalizedDate,
      slot: validation.normalizedSlot,
      passengerUser: {
        uid: decodedToken.uid,
        email: decodedToken.email || currentUserProfile?.email || "",
        name: currentUserProfile?.displayName || decodedToken.name || decodedToken.email || "Passenger",
      },
      boatData,
    });

    const stripe = getStripe();
    if (reservation.existingSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(reservation.existingSessionId);
      if (
        existingSession?.status === "open" &&
        existingSession?.payment_status === "unpaid" &&
        existingSession?.url
      ) {
        return json(200, {
          url: existingSession.url,
          sessionId: existingSession.id,
          bookingKey: reservation.bookingKey,
          reused: true,
        });
      }
    }

    const amountCents = Math.round(Number(boatData.price || 0) * 100);
    if (!amountCents || amountCents < 100) {
      return json(400, { error: "Listing price is invalid for checkout." });
    }

    const destinationCharge = buildDestinationCharge({
      amountCents,
      destinationAccountId: boatData.ownerStripeAccountId,
    });

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        submit_type: "book",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              unit_amount: amountCents,
              product_data: {
                name: `${boatData.name || "Boat Charter"} Charter`,
                description: `${validation.normalizedDate} - ${validation.normalizedSlot}`,
                images: boatData.coverImage || boatData.imageUrl ? [boatData.coverImage || boatData.imageUrl] : undefined,
              },
            },
          },
        ],
        success_url: `${appUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/booking-cancelled?booking_key=${encodeURIComponent(reservation.bookingKey)}`,
        payment_intent_data: {
          ...destinationCharge,
          metadata: buildCheckoutMetadata({
            bookingKey: reservation.bookingKey,
            boatData,
            passengerUser: { uid: decodedToken.uid },
            date: validation.normalizedDate,
            slot: validation.normalizedSlot,
          }),
        },
        metadata: buildCheckoutMetadata({
          bookingKey: reservation.bookingKey,
          boatData,
          passengerUser: { uid: decodedToken.uid },
          date: validation.normalizedDate,
          slot: validation.normalizedSlot,
        }),
        expires_at: Math.floor(reservation.reservedUntil.getTime() / 1000),
      },
      {
        idempotencyKey: `checkout_${reservation.bookingKey}_${decodedToken.uid}_${reservation.reservedUntil.getTime()}`,
      }
    );

    await reservation.bookingRef.set(
      {
        checkoutSessionId: session.id,
        checkoutUrl: session.url || "",
        reservedUntil: admin.firestore.Timestamp.fromMillis((session.expires_at || Math.floor(reservation.reservedUntil.getTime() / 1000)) * 1000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return json(200, {
      url: session.url,
      sessionId: session.id,
      bookingKey: reservation.bookingKey,
      reused: false,
    });
  } catch (error) {
    console.error("create-checkout-session error:", error);
    return json(500, { error: error.message || "Unable to create checkout session." });
  }
};
