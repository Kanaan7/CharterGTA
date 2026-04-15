const { requireAuth } = require("./_auth");
const { getStripe } = require("./_stripe");
const { handleOptions, json } = require("./_responses");
const { getStripeConnectState, syncOwnerStripeState } = require("./_marketplace");

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  if (!["GET", "POST"].includes(event.httpMethod)) {
    return json(405, { error: "Method not allowed." });
  }

  const authResult = await requireAuth(event);
  if (!authResult.ok) return authResult.response;

  try {
    const { decodedToken, db, admin } = authResult;
    const stripe = getStripe();
    const userSnapshot = await db.collection("users").doc(decodedToken.uid).get();
    const userProfile = userSnapshot.exists ? userSnapshot.data() : {};
    const accountId = userProfile?.stripeConnect?.accountId || "";

    if (!accountId) {
      return json(200, {
        ok: true,
        stripeConnect: {
          accountId: "",
          onboardingComplete: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          requirementsDue: [],
          requirementsPastDue: [],
        },
      });
    }

    const account = await stripe.accounts.retrieve(accountId);
    const stripeState = getStripeConnectState(account);

    await syncOwnerStripeState({
      db,
      userId: decodedToken.uid,
      stripeState,
      admin,
    });

    return json(200, {
      ok: true,
      stripeConnect: stripeState,
    });
  } catch (error) {
    console.error("get-stripe-connect-status error:", error);
    return json(500, { error: error.message || "Unable to load Stripe payout status." });
  }
};
