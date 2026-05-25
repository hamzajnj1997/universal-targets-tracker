import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-6 py-10 text-slate-950">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-500 text-2xl font-black text-white">
          ?
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">
          Real-Time Work Ownership Tracker
        </p>

        <h1 className="mt-3 text-3xl font-bold">You are offline</h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          The app could not reach the network. Reconnect to continue syncing,
          exporting, importing, or loading the latest version.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
