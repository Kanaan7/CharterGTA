const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const meta = session.metadata || {};

    const boatId = meta.boatId;
    const boatName = meta.boatName;
    const date = meta.date; // "YYYY-MM-DD"
    const slot = meta.slot; // "09:00-13:00"
    const userId = meta.userId;
    const ownerEmail = meta.ownerEmail || "";
    const ownerId = meta.ownerId || "";

    if (!boatId || !date || !slot || !userId) {
      console.error("Missing metadata:", meta);
      return { statusCode: 200, body: JSON.stringify({ received: true, skipped: true }) };
    }

    // prevent duplicates if Stripe retries
    const bookingId = session.id; // use session id as doc id

    try {
      await db.collection("bookings").doc(bookingId).set(
        {
          bookingId,
          boatId,
          boatName: boatName || "",
          date,
          slot,
          userId,
          ownerId,
          ownerEmail,
          price: (session.amount_total || 0) / 100,
          currency: session.currency || "cad",
          status: "confirmed",
          stripeSessionId: session.id,
          paymentIntent: session.payment_intent || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log("Booking created:", bookingId);
    } catch (error) {
      console.error("Error creating booking:", error);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to create booking" }) };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
