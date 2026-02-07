const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const firebase = require("firebase/compat/app");
require("firebase/compat/auth");
require("firebase/compat/firestore");

let firebaseInit = false;

function initFirebase() {
  if (firebaseInit) return;

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_* env vars in Netlify");
  }

  if (!firebase.apps.length) firebase.initializeApp(config);
  firebaseInit = true;
}

async function signInWebhookUser() {
  const email = process.env.FIREBASE_WEBHOOK_EMAIL;
  const password = process.env.FIREBASE_WEBHOOK_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing FIREBASE_WEBHOOK_EMAIL or FIREBASE_WEBHOOK_PASSWORD env vars");
  }

  // If already signed in, skip
  const current = firebase.auth().currentUser;
  if (current?.email === email) return;

  await firebase.auth().signInWithEmailAndPassword(email, password);
}

exports.handler = async (event) => {
  // Stripe signature verification needs RAW body string
  const sig =
    event.headers["stripe-signature"] ||
    event.headers["Stripe-Signature"] ||
    event.headers["STRIPE-SIGNATURE"];

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing stripe-signature header or STRIPE_WEBHOOK_SECRET" }),
    };
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: JSON.stringify({ error: `Webhook Error: ${err.message}` }) };
  }

  // Only handle completed payments
  if (stripeEvent.type === "checkout.session.completed") {
    try {
      initFirebase();
      await signInWebhookUser();

      const db = firebase.firestore();
      const session = stripeEvent.data.object;

      const md = session.metadata || {};
      const bookingId = session.id; // idempotent key (Stripe retries webhooks)

      await db.collection("bookings").doc(bookingId).set(
        {
          boatId: md.boatId || "",
          boatName: md.boatName || "",
          date: md.date || "",
          slot: md.slot || "",
          userId: md.userId || "",
          ownerId: md.ownerId || "",
          ownerEmail: md.ownerEmail || "",

          currency: session.currency || "cad",
          price: (session.amount_total || 0) / 100,
          status: "confirmed",

          checkoutSessionId: session.id,
          paymentIntentId: session.payment_intent || "",

          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log("✅ Booking saved:", bookingId);
    } catch (e) {
      console.error("❌ Webhook processing failed:", e);
      return { statusCode: 500, body: JSON.stringify({ error: "Webhook failed" }) };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
