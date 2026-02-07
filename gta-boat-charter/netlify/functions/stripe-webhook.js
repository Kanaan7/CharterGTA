const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;

  const b64 = process.env.FIREBASE_ADMIN_SA_B64;
  if (!b64) throw new Error("Missing FIREBASE_ADMIN_SA_B64 env var");

  const json = Buffer.from(b64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(json);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

exports.handler = async (event) => {
  // Stripe needs the RAW body for signature verification
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let stripeEvent;
  try {
    const sig = event.headers["stripe-signature"];
    if (!sig) return { statusCode: 400, body: "Missing stripe-signature header" };

    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    initAdmin();
  } catch (e) {
    console.error("Firebase admin init failed:", e.message);
    return { statusCode: 500, body: "Firebase admin init failed" };
  }

  const db = admin.firestore();

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const md = session.metadata || {};
      const boatId = md.boatId || "";
      const boatName = md.boatName || "";
      const date = md.date || "";
      const slot = md.slot || "";
      const userId = md.userId || "";
      const ownerEmail = md.ownerEmail || "";
      const ownerId = md.ownerId || "";

      // Idempotency: don’t create duplicate booking for same Checkout Session
      const bookingId = session.id; // use session id as doc id
      await db.collection("bookings").doc(bookingId).set(
        {
          bookingId,
          boatId,
          boatName,
          date,
          slot,
          userId,
          ownerId,
          ownerEmail,
          price: (session.amount_total || 0) / 100,
          currency: session.currency || "cad",
          status: "confirmed",
          paymentIntent: session.payment_intent || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error("Webhook handler error:", err);
    return { statusCode: 500, body: "Webhook failed" };
  }
};
