const { requireAuth } = require("./_auth");
const { getStripe } = require("./_stripe");
const { handleOptions, json } = require("./_responses");
const { getStripeConnectState, syncOwnerStripeState } = require("./_marketplace");

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const authResult = await requireAuth(event);
  if (!authResult.ok) return authResult.response;

  try {
    const { decodedToken, db, admin } = authResult;
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return json(500, { error: "Missing NEXT_PUBLIC_APP_URL env var." });
    }

    const userRef = db.collection("users").doc(decodedToken.uid);
    const userSnapshot = await userRef.get();
    const userProfile = userSnapshot.exists ? userSnapshot.data() : {};
    let accountId = userProfile?.stripeConnect?.accountId || "";

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "CA",
        email: decodedToken.email || userProfile?.email || "",
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          userId: decodedToken.uid,
        },
      });

      accountId = account.id;
      await syncOwnerStripeState({
        db,
        userId: decodedToken.uid,
        stripeState: getStripeConnectState(account),
        admin,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${appUrl}/?stripe=connect_refresh`,
      return_url: `${appUrl}/?stripe=connect_return`,
    });

    return json(200, {
      ok: true,
      url: accountLink.url,
      accountId,
    });
  } catch (error) {
    console.error("create-stripe-connect-account error:", error);
    return json(500, { error: error.message || "Unable to start Stripe onboarding." });
  }
};
