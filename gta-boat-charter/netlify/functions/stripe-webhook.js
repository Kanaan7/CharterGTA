const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;

  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT env var");

  const serviceAccount = JSON.parse(svc);

  // Fix private_key newlines if needed
  if (serviceAccount.private_key && serviceAccount.private_key.includes("\\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

exports.handler = async (event) => {
  try {
    initAdmin();
  } catch (e) {
    console.error("Firebase admin init failed:", e);
    return { statusCode: 500, body: "Firebase admin init failed" };
  }

  const db = admin.firestore();

  // Stripe signature header can come in different casing on Netlify
  const sig =
    event.headers["stripe-signature"] ||
    event.headers["Stripe-Signature"] ||
    event.headers["STRIPE-SIGNATURE"];

  if (!sig) {
    console.error("Missing Stripe signature header");
    return { statusCode: 400, body: "Missing Stripe signature" };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET env var");
    return { statusCode: 500, body: "Missing STRIPE_WEBHOOK_SECRET" };
  }

  let rawBody = event.body;

  // Netlify sometimes base64-encodes the body
  if (event.isBase64Encoded) {
    rawBody = Buffer.from(event.body, "base64").toString("utf8");
  }

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

      const md = session.metadata || {};
      const boatId = md.boatId;
      const boatName = md.boatName;
      const date = md.date;
      const slot = md.slot;
      const userId = md.userId;
      const ownerEmail = md.ownerEmail || "";
      const ownerId = md.ownerId || "";

      if (!boatId || !date || !slot || !userId) {
        console.error("Missing metadata in session:", md);
        return { statusCode: 200, body: "Missing metadata; ignored" };
      }

      // Prevent duplicates if Stripe retries the webhook
      const bookingId = session.id; // stable unique id per checkout session

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

          paymentId: session.payment_intent || "",
          customerEmail: session.customer_details?.email || "",

          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log("✅ Booking created:", bookingId);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error("Webhook handler error:", error);
    return { statusCode: 500, body: "Webhook failed" };
  }
};
