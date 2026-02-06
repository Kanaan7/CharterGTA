"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function SuccessInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-sky-100 p-8 max-w-lg w-full text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Booking Confirmed ✅</h1>
        <p className="text-slate-600">
          Thanks! Your payment went through.
        </p>

        {sessionId ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left">
            <div className="text-xs text-slate-500 mb-1">Session ID</div>
            <div className="font-mono text-sm break-all">{sessionId}</div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No session id found.</p>
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
