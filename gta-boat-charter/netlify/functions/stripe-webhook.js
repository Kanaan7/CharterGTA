// netlify/functions/stripe-webhook.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      "Missing Firebase Admin env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)."
    );
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
  // Stripe expects a 2xx when you successfully receive the event.
  // If you return non-2xx, Stripe retries.
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

  // Netlify normalizes headers to lowercase, but we’ll check a few just in case
  const sig =
    event.headers?.["stripe-signature"] ||
    event.headers?.["Stripe-Signature"] ||
    event.headers?.["STRIPE-SIGNATURE"];

  if (!sig) {
    console.error("Missing stripe-signature header");
    return { statusCode: 400, body: "Missing stripe-signature header" };
  }

  // IMPORTANT:
  // Stripe signature must be computed over the *raw* request body bytes.
  // Netlify passes body as string; if isBase64Encoded, decode it.
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

  // Only handle events you care about
  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    const {
      boatId,
      boatName,
      date,
      slot,
      userId,
      ownerEmail,
      ownerId,
    } = session.metadata || {};

    // If required metadata is missing, don't fail the webhook (or Stripe will retry forever)
    if (!boatId || !date || !slot || !userId) {
      console.error("Missing required metadata", session.metadata);
      return { statusCode: 200, body: "Missing metadata (ignored)" };
    }

    const db = admin.firestore();

    // ✅ Idempotency: deterministic booking id prevents duplicates on Stripe retries
    const bookingId = `${boatId}__${date}__${slot}__${userId}`;

    try {
      // ✅ Create/Update booking
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
          // Optional useful fields:
          customerEmail: session.customer_details?.email || session.customer_email || "",
        },
        { merge: true }
      );

      // ✅ OPTIONAL: also lock the slot on the boat doc (if you later want owner-driven availability lists)
      // (Your UI already hides slots by reading confirmed bookings, so this is not strictly required.)
      // This safely merges a "bookedSlots" map without deleting anything.
      const boatRef = db.collection("boats").doc(boatId);
      await boatRef.set(
        {
          bookedSlots: {
            [date]: admin.firestore.FieldValue.arrayUnion(slot),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log("Booking created/updated:", bookingId);
    } catch (err) {
      console.error("Error writing booking:", err);
      // Returning 500 makes Stripe retry — which is OK if it was a transient failure.
      return { statusCode: 500, body: "Failed to write booking" };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
