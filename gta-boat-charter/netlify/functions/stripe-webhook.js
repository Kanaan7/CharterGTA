const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error("Missing Firebase Admin env vars (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY).");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
    }),
  });
}

exports.handler = async (event) => {
  try {
    initAdmin();
  } catch (e) {
    console.error("Firebase admin init failed:", e.message);
    return { statusCode: 500, body: "Firebase admin init failed" };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return { statusCode: 500, body: "Missing STRIPE_WEBHOOK_SECRET" };
  }

  const sig =
    event.headers["stripe-signature"] ||
    event.headers["Stripe-Signature"] ||
    event.headers["STRIPE-SIGNATURE"];

  if (!sig) {
    console.error("Missing stripe-signature header");
    return { statusCode: 400, body: "Missing stripe-signature header" };
  }

  // Netlify sometimes base64 encodes body
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle event
  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    // metadata you send from create-checkout-session
    const {
      boatId,
      boatName,
      date,
      slot,
      userId,
      ownerEmail,
      ownerId,
    } = session.metadata || {};

    if (!boatId || !date || !slot || !userId) {
      console.error("Missing required metadata", session.metadata);
      return { statusCode: 200, body: "Missing metadata (ignored)" };
    }

    const db = admin.firestore();

    // Use a deterministic doc id to prevent duplicates if Stripe retries webhook
    const bookingId = `${boatId}__${date}__${slot}__${userId}`;

    try {
      await db.collection("bookings").doc(bookingId).set(
        {
          boatId,
          boatName: boatName || "Boat",
          date,
          slot,
          userId,
          ownerId: ownerId || "",
          ownerEmail: ownerEmail || "",
          price: (session.amount_total || 0) / 100,
          currency: session.currency || "cad",
          status: "confirmed",
          checkoutSessionId: session.id,
          paymentIntentId: session.payment_intent || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log("Booking created/updated:", bookingId);
    } catch (err) {
      console.error("Error writing booking:", err);
      return { statusCode: 500, body: "Failed to write booking" };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
