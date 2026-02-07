"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function SuccessInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState("idle"); // idle | verifying | confirmed | failed
  const [error, setError] = useState("");

  useEffect(() => {
    const verify = async () => {
      if (!sessionId) return;

      setStatus("verifying");
      setError("");

      try {
        const res = await fetch("/api/verify-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Verification failed");
        }

        setStatus("confirmed");
      } catch (e) {
        console.error("verify-checkout-session failed:", e);
        setStatus("failed");
        setError(e?.message || "Verification failed");
      }
    };

    verify();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-sky-100 p-8 max-w-lg w-full text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Booking Confirmed ✅</h1>
        <p className="text-slate-600">Thanks! Your payment went through.</p>

        {sessionId ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left">
            <div className="text-xs text-slate-500 mb-1">Session ID</div>
            <div className="font-mono text-sm break-all">{sessionId}</div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No session id found.</p>
        )}

        {/* Verification status (this is what actually saves booking if webhook failed) */}
        {sessionId && (
          <div className="text-sm">
            {status === "idle" && <span className="text-slate-500">Ready to verify booking…</span>}
            {status === "verifying" && <span className="text-blue-600 font-medium">Finalizing booking in database…</span>}
            {status === "confirmed" && <span className="text-green-600 font-bold">Booking saved ✅ (My Bookings will update)</span>}
            {status === "failed" && (
              <div className="text-red-600">
                <div className="font-bold">Couldn’t finalize booking.</div>
                <div className="text-xs mt-1 break-words">{error}</div>
              </div>
            )}
          </div>
        )}

        <a
          href="/"
          className="inline-flex items-center justify-center px-5 py-3 rounded-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-lg transition"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SuccessInner />
    </Suspense>
  );
}
