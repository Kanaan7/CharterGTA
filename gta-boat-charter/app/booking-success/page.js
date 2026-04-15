"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { authorizedJson } from "../../lib/api";
import { formatDateLabel, formatMoneyWithCurrency, formatSlotLabel, formatStatusLabel } from "../../lib/marketplace/format";

function SuccessInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    const loadBooking = async () => {
      if (!sessionId) return;

      setStatus("loading");
      setError("");

      try {
        const data = await authorizedJson("/api/verify-checkout-session", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });

        setBooking(data.booking || null);
        setStatus(data.booking?.status === "confirmed" ? "confirmed" : "pending");
      } catch (loadError) {
        setStatus("failed");
        setError(loadError.message || "Unable to load booking details.");
      }
    };

    loadBooking();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-sky-100 p-8 max-w-lg w-full text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Booking confirmed</h1>
        <p className="text-slate-600">Your payment went through. We're checking the final booking record now.</p>

        {sessionId ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left">
            <div className="text-xs text-slate-500 mb-1">Session ID</div>
            <div className="font-mono text-sm break-all">{sessionId}</div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No session ID was found in the URL.</p>
        )}

        <div className="text-sm">
          {status === "idle" && <span className="text-slate-500">Preparing booking lookup...</span>}
          {status === "loading" && <span className="text-blue-600 font-medium">Loading secure booking details...</span>}
          {status === "confirmed" && <span className="text-green-600 font-bold">Booking saved and confirmed.</span>}
          {status === "pending" && <span className="text-amber-600 font-bold">Payment succeeded. Booking sync is still processing.</span>}
          {status === "failed" && (
            <div className="text-red-600">
              <div className="font-bold">Couldn't load booking details.</div>
              <div className="text-xs mt-1 break-words">{error}</div>
            </div>
          )}
        </div>

        {booking ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700 space-y-2">
            <div className="font-semibold text-slate-900">{booking.boatName || "Boat Charter"}</div>
            <div>{formatDateLabel(booking.date)} - {formatSlotLabel(booking.slot)}</div>
            <div>Status: {formatStatusLabel(booking.status)}</div>
            <div>Total: {formatMoneyWithCurrency(booking.price, booking.currency)}</div>
            {booking.bookingReference ? <div>Reference: {booking.bookingReference}</div> : null}
          </div>
        ) : null}

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
