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
    const stripe = getStripe();
    const userSnapshot = await db.collection("users").doc(decodedToken.uid).get();
    const accountId = userSnapshot.exists ? userSnapshot.data()?.stripeConnect?.accountId || "" : "";

    if (!accountId) {
      return json(400, { error: "Connect a Stripe account before opening the payout dashboard." });
    }

    const loginLink = await stripe.accounts.createLoginLink(accountId);

    return json(200, {
      ok: true,
      url: loginLink.url,
    });
  } catch (error) {
    console.error("create-stripe-dashboard-link error:", error);
    return json(500, { error: error.message || "Unable to open Stripe dashboard." });
  }
};
