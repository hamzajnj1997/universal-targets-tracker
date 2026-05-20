"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  type AuthMode,
  getCurrentUser,
  sendPasswordReset,
  signInWithPassword,
  signUpWithPassword,
} from "../../../lib/workOwnershipApi";

type AuthScreenProps = {
  mode: AuthMode;
};

type EmailVerificationFields = {
  confirmed_at?: string | null;
  email_confirmed_at?: string | null;
  email_confirmed?: boolean;
};

function isEmailVerified(user: User | null | undefined) {
  if (!user) return false;

  const verifiedUser = user as User & EmailVerificationFields;
  return Boolean(
    verifiedUser.confirmed_at ||
      verifiedUser.email_confirmed_at ||
      verifiedUser.email_confirmed
  );
}

function authTitle(mode: AuthMode) {
  if (mode === "signup") return "Create your account";
  if (mode === "forgot") return "Reset your password";
  return "Sign in";
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState(
    searchParams.get("authVerified") === "true"
      ? "Email verified. Sign in to continue."
      : ""
  );
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getCurrentUser()
      .then((user) => {
        if (!isMounted || !user || !isEmailVerified(user)) return;
        router.replace("/app/board");
      })
      .catch(() => {
        if (isMounted) setMessage("Connect Supabase environment variables to enable auth.");
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);
    setMessage("");

    try {
      if (mode === "forgot") {
        await sendPasswordReset(email);
        setMessage("Password reset email sent.");
        return;
      }

      if (mode === "signup") {
        const user = await signUpWithPassword(email, password, displayName);
        if (!isEmailVerified(user)) {
          setPassword("");
          setMessage(
            "Account created. Check your email and confirm the verification link before signing in."
          );
          return;
        }
        router.replace("/onboarding");
        return;
      }

      const user = await signInWithPassword(email, password);
      if (!isEmailVerified(user)) {
        setPassword("");
        setMessage("Email not verified. Check your inbox and confirm your account.");
        return;
      }
      router.replace("/app/board");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Auth action failed.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Real-Time Work Ownership Tracker
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{authTitle(mode)}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Track live ownership with team-safe claim, release, block, complete,
            and audit actions.
          </p>
        </div>

        <form
          onSubmit={submitAuth}
          className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5"
        >
          {mode === "signup" ? (
            <label className="block text-sm font-semibold text-slate-200">
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300"
                placeholder="Your name"
              />
            </label>
          ) : null}

          <label className="block text-sm font-semibold text-slate-200">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300"
              placeholder="you@example.com"
            />
          </label>

          {mode !== "forgot" ? (
            <label className="block text-sm font-semibold text-slate-200">
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
                minLength={6}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300"
                placeholder="At least 6 characters"
              />
            </label>
          ) : null}

          {message ? (
            <p className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm leading-6 text-cyan-50">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isWorking}
            className="w-full rounded-md bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isWorking ? "Working..." : authTitle(mode)}
          </button>
        </form>

        <nav className="mt-5 flex flex-wrap gap-3 text-sm text-slate-300">
          {mode !== "login" ? <Link href="/login">Sign in</Link> : null}
          {mode !== "signup" ? <Link href="/signup">Create account</Link> : null}
          {mode !== "forgot" ? <Link href="/forgot-password">Forgot password</Link> : null}
        </nav>
      </section>
    </main>
  );
}
