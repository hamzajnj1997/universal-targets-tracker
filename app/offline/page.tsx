import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-10 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400 text-2xl font-black text-slate-950">
          ?
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Universal Targets Tracker
        </p>

        <h1 className="mt-3 text-3xl font-bold">You are offline</h1>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          The app could not reach the network. Reconnect to continue syncing,
          exporting, importing, or loading the latest version.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
