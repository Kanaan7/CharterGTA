import StatusBanner from "./StatusBanner";

function getConnectState(stripeConnect) {
  if (!stripeConnect?.accountId) {
    return {
      tone: "warning",
      title: "Stripe payouts not connected",
      body: "Owners need a connected Stripe Express account before passengers can complete live bookings.",
      actionLabel: "Connect Stripe",
    };
  }

  if (!stripeConnect?.onboardingComplete) {
    return {
      tone: "warning",
      title: "Stripe onboarding incomplete",
      body: "Finish Stripe onboarding so charges and payouts are fully enabled for your marketplace listings.",
      actionLabel: "Continue onboarding",
    };
  }

  return {
    tone: "success",
    title: "Stripe payouts connected",
    body: "Guests can book securely and payouts can route to your connected owner account.",
    actionLabel: "Review setup",
  };
}

export default function OwnerPayoutCard({
  stripeConnect,
  loading = false,
  compact = false,
  onConnect,
  onRefresh,
  onManage,
}) {
  const state = getConnectState(stripeConnect || {});
  const dueItems = [
    ...(stripeConnect?.requirementsDue || []),
    ...(stripeConnect?.requirementsPastDue || []),
  ].slice(0, 3);

  return (
    <div className="space-y-3 rounded-3xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/80 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Owner payouts</div>
          <h3 className="mt-1 text-xl font-extrabold text-slate-950">
            {compact ? "Stripe Connect status" : "Marketplace payout setup"}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {compact
              ? "Keep your connected payout account in good standing so bookings stay enabled."
              : "This marketplace uses Stripe Connect Express for onboarding, destination charges, and owner payouts."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onRefresh} className="btn-ghost justify-center sm:justify-start" disabled={loading}>
            Refresh
          </button>
          {stripeConnect?.onboardingComplete ? (
            <button type="button" onClick={onManage} className="btn-secondary sm:w-auto" disabled={loading}>
              Open Stripe
            </button>
          ) : null}
        </div>
      </div>

      <StatusBanner tone={state.tone} title={state.title}>
        {state.body}
      </StatusBanner>

      {stripeConnect?.accountId ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 md:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</div>
            <div className="mt-1 break-all text-sm font-semibold text-slate-900">{stripeConnect.accountId}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Charges</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {stripeConnect.chargesEnabled ? "Enabled" : "Not enabled"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payouts</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {stripeConnect.payoutsEnabled ? "Enabled" : "Not enabled"}
            </div>
          </div>
        </div>
      ) : null}

      {dueItems.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-bold">Stripe still needs:</div>
          <div className="mt-1">{dueItems.join(", ")}</div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-slate-500">
          Listings can stay visible while you set this up, but checkout is blocked until onboarding is complete.
        </div>

        <button type="button" onClick={onConnect} className="btn-primary" disabled={loading}>
          {loading ? "Loading..." : state.actionLabel}
        </button>
      </div>
    </div>
  );
}
