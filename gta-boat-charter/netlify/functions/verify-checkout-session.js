const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error("Missing Firebase Admin env vars.");
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
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    initAdmin();
    const db = admin.firestore();

    const { sessionId } = JSON.parse(event.body || "{}");
    if (!sessionId) return { statusCode: 400, body: JSON.stringify({ error: "Missing sessionId" }) };

    // Fetch session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return { statusCode: 400, body: JSON.stringify({ error: "Session not paid" }) };
    }

    const meta = session.metadata || {};
    const { boatId, boatName, date, slot, userId, ownerEmail, ownerId } = meta;

    if (!boatId || !date || !slot || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing metadata in session" }) };
    }

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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { statusCode: 200, body: JSON.stringify({ ok: true, bookingId }) };
  } catch (e) {
    console.error("verify-checkout-session error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
