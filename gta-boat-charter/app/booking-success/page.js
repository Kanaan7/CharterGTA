"use client";

import { useSearchParams } from "next/navigation";

export default function BookingSuccessPage() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border rounded-2xl shadow p-8 max-w-lg w-full">
        <h1 className="text-2xl font-bold mb-2">Booking Confirmed ✅</h1>
        <p className="text-slate-600 mb-4">
          Payment completed. Your booking will be confirmed in a moment.
        </p>

        <div className="text-sm text-slate-500 break-all">
          <div className="font-semibold text-slate-700 mb-1">Stripe Session ID</div>
          {sessionId || "—"}
        </div>

        <a
          href="/"
          className="mt-6 inline-block bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
