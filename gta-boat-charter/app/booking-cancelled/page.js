"use client";

export default function BookingCancelledPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border rounded-2xl shadow p-8 max-w-lg w-full">
        <h1 className="text-2xl font-bold mb-2">Booking Cancelled</h1>
        <p className="text-slate-600 mb-6">No worries — you weren’t charged.</p>

        <a
          href="/"
          className="inline-block bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
