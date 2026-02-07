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
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    initAdmin();
  } catch (e) {
    console.error("Firebase admin init failed:", e.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Missing Firebase Admin env vars.",
        details: e.message,
      }),
    };
  }

  try {
    const { sessionId } = JSON.parse(event.body || "{}");
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing sessionId" }),
      };
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid = session.payment_status === "paid" || session.status === "complete";
    if (!paid) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Payment not confirmed.",
          payment_status: session.payment_status,
          status: session.status,
        }),
      };
    }

    const { boatId, boatName, date, slot, userId, ownerEmail, ownerId } = session.metadata || {};
    if (!boatId || !date || !slot || !userId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Missing required booking metadata on Stripe session.",
          metadata: session.metadata || {},
        }),
      };
    }

    const db = admin.firestore();
    const bookingId = `${boatId}__${date}__${slot}__${userId}`;

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
        customerEmail: session.customer_details?.email || session.customer_email || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, bookingId }),
    };
  } catch (err) {
    console.error("verify-checkout-session failed:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message || "Server error" }),
    };
  }
};
