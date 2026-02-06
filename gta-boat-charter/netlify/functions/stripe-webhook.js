const Stripe = require("stripe");
const admin = require("firebase-admin");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Firebase Admin init (Netlify-friendly)
// Put your service account JSON into env var: FIREBASE_SERVICE_ACCOUNT_JSON
// (paste the entire JSON string)
if (!admin.apps.length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!svc) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var");
  } else {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(svc)),
    });
  }
}

const db = admin.apps.length ? admin.firestore() : null;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) return { statusCode: 400, body: "Missing Stripe signature header" };
  if (!webhookSecret) return { statusCode: 500, body: "Missing STRIPE_WEBHOOK_SECRET" };
  if (!db) return { statusCode: 500, body: "Firebase Admin not initialized" };

  // IMPORTANT: use RAW body for signature verification
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64")
    : Buffer.from(event.body || "", "utf8");

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const { boatId, boatName, date, slot, userId, ownerEmail } = session.metadata || {};

      if (!boatId || !date || !slot || !userId) {
        console.error("Missing metadata:", session.metadata);
        return { statusCode: 200, body: "Missing metadata, skipped" };
      }

      // Idempotency: use session.id as booking doc id so you don't double-book
      const bookingRef = db.collection("bookings").doc(session.id);
      const bookingSnap = await bookingRef.get();

      if (!bookingSnap.exists) {
        await bookingRef.set({
          boatId,
          boatName: boatName || "",
          date,
          slot,
          userId,
          ownerEmail: ownerEmail || "",
          price: session.amount_total ? session.amount_total / 100 : null,
          currency: session.currency || "cad",
          status: "confirmed",
          paymentId: session.payment_intent || null,
          checkoutSessionId: session.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // OPTIONAL: also write a slot lock doc for quick lookups
        // (prevents duplicates easier when you later build availability subtract)
        const slotKey = `${date}_${slot}`.replace(/[^a-zA-Z0-9_-]/g, "_");
        await db
          .collection("boats")
          .doc(boatId)
          .collection("bookedSlots")
          .doc(slotKey)
          .set(
            {
              date,
              slot,
              bookingId: session.id,
              userId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error("Webhook handler error:", err);
    return { statusCode: 500, body: "Server error" };
  }
};
