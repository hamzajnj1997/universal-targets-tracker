"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createTeam,
  getCurrentUser,
  joinTeamByInviteCode,
  signOut,
} from "../../../lib/workOwnershipApi";

export function OnboardingScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState(searchParams.get("invite") ?? "");
  const [message, setMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getCurrentUser()
      .then(async (user) => {
        if (!isMounted) return;
        if (!user) {
          router.replace("/login");
          return;
        }

      })
      .catch((error) => {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Unable to load teams.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function createNewTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTeamName = teamName.trim();
    if (normalizedTeamName.length < 2) {
      setMessage("Team name must be at least 2 characters.");
      return;
    }

    setIsWorking(true);
    setMessage("");

    try {
      const team = await createTeam(normalizedTeamName);
      window.localStorage.setItem("work-ownership-active-team", team.id);
      router.replace("/app/board");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Team creation failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function joinTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedInviteCode = inviteCode.trim().toUpperCase();
    if (normalizedInviteCode.length < 6) {
      setMessage("Enter a valid invite code.");
      return;
    }

    setIsWorking(true);
    setMessage("");
    setInviteCode(normalizedInviteCode);

    try {
      const team = await joinTeamByInviteCode(normalizedInviteCode);
      window.localStorage.setItem("work-ownership-active-team", team.id);
      router.replace("/app/board");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Team join failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Team setup
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Create or join a work ownership team
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
            A team gives the Live Board one clear place for available work,
            claimed work, blockers, completed targets, notes, and audit history.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-300">
            <Link href="/app/board">Open app</Link>
            <button type="button" onClick={logout} className="text-slate-300">
              Logout
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <form
            onSubmit={createNewTeam}
            noValidate
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-5"
          >
            <h2 className="text-xl font-bold">Create team</h2>
            <label className="mt-4 block text-sm font-semibold text-slate-200">
              Team name
              <input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                autoComplete="organization"
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300"
                placeholder="Operations team"
              />
            </label>
            <button
              type="submit"
              disabled={isWorking || teamName.trim().length < 2}
              className="mt-4 w-full rounded-md bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create team
            </button>
          </form>

          <form
            onSubmit={joinTeam}
            noValidate
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-5"
          >
            <h2 className="text-xl font-bold">Join team</h2>
            <label className="mt-4 block text-sm font-semibold text-slate-200">
              Invite code
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 uppercase text-white outline-none focus:border-cyan-300"
                placeholder="ABC123XYZ"
              />
            </label>
            <button
              type="submit"
              disabled={isWorking || inviteCode.trim().length < 6}
              className="mt-4 w-full rounded-md border border-slate-700 px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Join team
            </button>
          </form>

          {message ? (
            <p className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm leading-6 text-amber-50">
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
