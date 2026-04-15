const { requireAuth } = require("./_auth");
const { getStripe } = require("./_stripe");
const { handleOptions, json } = require("./_responses");

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const authResult = await requireAuth(event);
  if (!authResult.ok) return authResult.response;

  try {
    const { decodedToken, db } = authResult;
    const { sessionId } = JSON.parse(event.body || "{}");

    if (!sessionId) {
      return json(400, { error: "Missing sessionId." });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));
    const metadata = session?.metadata || {};

    if (!metadata.bookingKey || metadata.passengerUserId !== decodedToken.uid) {
      return json(403, { error: "This checkout session does not belong to your account." });
    }

    const bookingSnapshot = await db.collection("bookings").doc(metadata.bookingKey).get();
    const booking = bookingSnapshot.exists ? { id: bookingSnapshot.id, ...bookingSnapshot.data() } : null;

    return json(200, {
      ok: true,
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
      },
      booking,
    });
  } catch (error) {
    console.error("verify-checkout-session error:", error);
    return json(500, { error: error.message || "Unable to verify checkout session." });
  }
};
