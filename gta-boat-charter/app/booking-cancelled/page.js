export default function BookingCancelledPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-sky-100 p-8 max-w-lg w-full text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Checkout cancelled</h1>
        <p className="text-slate-600">
          No charge was captured. Your reservation hold will expire automatically if you don't return to complete checkout.
        </p>
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
