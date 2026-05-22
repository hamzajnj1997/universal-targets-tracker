"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  addTargetNote,
  archiveTarget,
  blockTarget,
  claimTarget,
  completeTarget,
  createTarget,
  forceReleaseTarget,
  getClientForRealtime,
  getCurrentUser,
  inviteMemberByEmail,
  listTeams,
  loadBoardData,
  releaseTarget,
  reopenTarget,
  signOut,
} from "../../../lib/workOwnershipApi";
import type {
  BoardData,
  TargetPriority,
  Team,
  TeamMember,
  TeamRole,
  WorkTarget,
} from "../../../lib/workOwnershipTypes";
import {
  calculateDashboardMetrics,
  canCreateTarget,
  filterTargetsForSearch,
  isManagerRole,
  splitBoardTargets,
  todayISO,
} from "../../../lib/workOwnershipRules";
import { LiveBoard } from "./LiveBoard";
import {
  TargetDrawer,
  type TargetDrawerAction,
} from "./TargetDrawer";

const ACTIVE_TEAM_KEY = "work-ownership-active-team";

const emptyBoardData: BoardData = {
  members: [],
  targets: [],
  activities: [],
  notes: [],
  capabilities: {
    schemaMode: "legacy",
    supportsBlockers: false,
    supportsNotes: false,
    supportsActivityLog: false,
  },
};

type AppShellProps = {
  children: ReactNode;
};

type TargetForm = {
  title: string;
  description: string;
  priority: TargetPriority;
  dueDate: string;
};

const defaultTargetForm: TargetForm = {
  title: "",
  description: "",
  priority: "medium",
  dueDate: todayISO(),
};

const navItems = [
  { href: "/app/board", label: "Live Board" },
  { href: "/app/my-work", label: "My Work" },
  { href: "/app/completed", label: "Completed" },
  { href: "/app/dashboard", label: "Dashboard" },
];

function DatabaseModeBanner({
  mode,
}: {
  mode: BoardData["capabilities"];
}) {
  if (mode.schemaMode === "workOwnership") {
    return (
      <div className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50">
        Work ownership database is active. Blockers, notes, audit log, and protected actions are available.
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-50">
      Legacy database mode is active. Claim, release, complete, create, and archive use the existing tracker tables. Block reasons, notes, invite links, and full audit history need the Supabase migration in <span className="font-mono">supabase/migrations/20260521_work_ownership_tracker.sql</span>.
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState("");
  const [boardData, setBoardData] = useState<BoardData>(emptyBoardData);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingTarget, setIsCreatingTarget] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [targetForm, setTargetForm] = useState<TargetForm>(defaultTargetForm);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");

  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;
  const currentMember: TeamMember | null = useMemo(() => {
    if (!user) return null;
    const member =
      boardData.members.find(
        (teamMember) => teamMember.userId === user.id && teamMember.status === "active"
      ) ?? null;

    if (member) return member;
    if (!activeTeam || activeTeam.ownerId !== user.id) return null;

    return {
      id: `owner-${activeTeam.id}`,
      teamId: activeTeam.id,
      userId: user.id,
      name: user.email ?? "Team owner",
      email: user.email ?? undefined,
      role: "owner",
      status: "active",
    };
  }, [activeTeam, boardData.members, user]);
  const selectedTarget =
    boardData.targets.find((target) => target.id === selectedTargetId) ?? null;
  const metrics = useMemo(() => calculateDashboardMetrics(boardData), [boardData]);
  const visibleTargets = useMemo(
    () => filterTargetsForSearch(boardData.targets, searchQuery),
    [boardData.targets, searchQuery]
  );
  const splitTargets = useMemo(
    () => splitBoardTargets(visibleTargets, currentMember),
    [currentMember, visibleTargets]
  );

  const refreshBoard = useCallback(
    async (teamId = activeTeamId) => {
      if (!teamId) return;
      setIsRefreshing(true);
      try {
        const data = await loadBoardData(teamId);
        setBoardData(data);
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load board.");
      } finally {
        setIsRefreshing(false);
      }
    },
    [activeTeamId]
  );

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      setIsBooting(true);
      try {
        const signedInUser = await getCurrentUser();
        if (!isMounted) return;

        if (!signedInUser) {
          router.replace("/login");
          return;
        }

        setUser(signedInUser);
        const accessibleTeams = await listTeams();
        if (!isMounted) return;

        if (accessibleTeams.length === 0) {
          router.replace("/onboarding");
          return;
        }

        setTeams(accessibleTeams);
        const storedTeamId =
          typeof window === "undefined"
            ? ""
            : window.localStorage.getItem(ACTIVE_TEAM_KEY) ?? "";
        const nextTeam =
          accessibleTeams.find((team) => team.id === storedTeamId) ?? accessibleTeams[0];
        setActiveTeamId(nextTeam.id);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(ACTIVE_TEAM_KEY, nextTeam.id);
        }
        const data = await loadBoardData(nextTeam.id);
        if (isMounted) setBoardData(data);
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Unable to open app.");
        }
      } finally {
        if (isMounted) setIsBooting(false);
      }
    }

    void boot();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!activeTeamId) return;

    const supabase = getClientForRealtime();
    if (!supabase) return;

    const refresh = () => {
      void refreshBoard(activeTeamId);
    };
    const channel = supabase
      .channel(`work-ownership-${activeTeamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "targets", filter: `workspace_id=eq.${activeTeamId}` },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "target_activity",
          filter: `workspace_id=eq.${activeTeamId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "target_notes",
          filter: `workspace_id=eq.${activeTeamId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${activeTeamId}`,
        },
        refresh
      )
      .subscribe();

    const fallbackRefresh = window.setInterval(refresh, 45000);

    return () => {
      window.clearInterval(fallbackRefresh);
      void supabase.removeChannel(channel);
    };
  }, [activeTeamId, refreshBoard]);

  async function switchTeam(teamId: string) {
    setActiveTeamId(teamId);
    window.localStorage.setItem(ACTIVE_TEAM_KEY, teamId);
    await refreshBoard(teamId);
    setIsMenuOpen(false);
  }

  function mergeTargetIntoBoard(updatedTarget: WorkTarget) {
    setBoardData((data) => {
      const hasTarget = data.targets.some((target) => target.id === updatedTarget.id);

      return {
        ...data,
        targets: hasTarget
          ? data.targets.map((target) =>
              target.id === updatedTarget.id ? updatedTarget : target
            )
          : [updatedTarget, ...data.targets],
      };
    });
  }

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  async function submitTarget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTeam || !canCreateTarget(currentMember)) return;

    setIsCreatingTarget(true);
    setMessage("");

    try {
      await createTarget({
        teamId: activeTeam.id,
        title: targetForm.title,
        description: targetForm.description,
        priority: targetForm.priority,
        dueDate: targetForm.dueDate || undefined,
      });
      setTargetForm(defaultTargetForm);
      setIsCreateOpen(false);
      await refreshBoard(activeTeam.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Target creation failed.");
    } finally {
      setIsCreatingTarget(false);
    }
  }

  async function runTargetAction(
    action: TargetDrawerAction,
    target: WorkTarget,
    reason = ""
  ) {
    setBusyTargetId(target.id);
    setMessage("");

    try {
      let updatedTarget: WorkTarget | null = null;

      if (action === "claim") updatedTarget = await claimTarget(target.id);
      if (action === "release") updatedTarget = await releaseTarget(target.id, reason);
      if (action === "forceRelease") {
        updatedTarget = await forceReleaseTarget(target.id, reason);
      }
      if (action === "block") updatedTarget = await blockTarget(target.id, reason);
      if (action === "complete") updatedTarget = await completeTarget(target.id);
      if (action === "reopen") updatedTarget = await reopenTarget(target.id);
      if (action === "archive") updatedTarget = await archiveTarget(target.id);

      if (updatedTarget) mergeTargetIntoBoard(updatedTarget);
      await refreshBoard(target.teamId);
      if (updatedTarget) mergeTargetIntoBoard(updatedTarget);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Target action failed.");
    } finally {
      setBusyTargetId(null);
    }
  }

  async function addNote(target: WorkTarget, body: string) {
    setBusyTargetId(target.id);
    setMessage("");

    try {
      await addTargetNote(target.id, body);
      await refreshBoard(target.teamId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Adding note failed.");
    } finally {
      setBusyTargetId(null);
    }
  }

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTeam || !isManagerRole(currentMember?.role)) return;

    setMessage("");

    try {
      await inviteMemberByEmail({
        teamId: activeTeam.id,
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      await refreshBoard(activeTeam.id);
      setMessage("Invite prepared. Share the invite code if the member is not signed up yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invite failed.");
    }
  }

  async function copyInviteLink() {
    if (!activeTeam || typeof window === "undefined") return;
    if (!activeTeam.inviteCode) {
      setMessage(
        "Invite links require the work ownership database upgrade. Use Members -> Invite by email for now."
      );
      return;
    }

    const link = `${window.location.origin}/onboarding?invite=${activeTeam.inviteCode}`;
    try {
      await window.navigator.clipboard.writeText(link);
      setMessage("Invite link copied.");
    } catch {
      setMessage(`Invite code: ${activeTeam.inviteCode}`);
    }
  }

  function renderDashboard() {
    const metricCards = [
      ["Available targets", metrics.availableTargets],
      ["Currently claimed", metrics.claimedTargets],
      ["Blocked targets", metrics.blockedTargets],
      ["Completed today", metrics.completedToday],
      ["Completed this week", metrics.completedThisWeek],
      ["Stale claimed", metrics.staleClaimedTargets],
      [
        "Avg completion time",
        metrics.averageCompletionHours === null
          ? "n/a"
          : `${metrics.averageCompletionHours.toFixed(1)}h`,
      ],
    ];

    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-800 bg-slate-950/80 p-4"
            >
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-5">
          <h2 className="text-xl font-bold text-white">Most active members</h2>
          <div className="mt-4 grid gap-3">
            {metrics.mostActiveMembers.length === 0 ? (
              <p className="text-sm text-slate-400">No activity yet.</p>
            ) : (
              metrics.mostActiveMembers.map((entry) => (
                <div
                  key={entry.member.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
                >
                  <span className="font-semibold text-white">{entry.member.name}</span>
                  <span className="text-sm text-slate-300">{entry.actions} actions</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  function renderSettings() {
    if (pathname.endsWith("/settings/members")) {
      return (
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Members</h2>
                <p className="text-sm text-slate-400">
                  Active members can view the board and act through protected RPCs.
                </p>
              </div>
              <button
                type="button"
                onClick={copyInviteLink}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100"
              >
                Copy invite link
              </button>
            </div>

            {isManagerRole(currentMember?.role) ? (
              <form onSubmit={inviteMember} className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  type="email"
                  required
                  placeholder="member@example.com"
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300"
                />
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as TeamRole)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Invite
                </button>
              </form>
            ) : null}

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-800">
              {boardData.members.map((member) => (
                <div
                  key={member.id}
                  className="grid gap-2 border-b border-slate-800 bg-slate-900/40 p-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto]"
                >
                  <div>
                    <p className="font-semibold text-white">{member.name}</p>
                    <p className="text-sm text-slate-500">{member.email ?? member.userId ?? "Pending invite"}</p>
                  </div>
                  <span className="h-fit rounded-full border border-slate-700 px-3 py-1 text-sm capitalize text-slate-200">
                    {member.role}
                  </span>
                  <span className="h-fit rounded-full border border-slate-700 px-3 py-1 text-sm capitalize text-slate-200">
                    {member.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (pathname.endsWith("/settings/team")) {
      return (
        <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-5">
          <h2 className="text-xl font-bold text-white">Team settings</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Team</dt>
              <dd className="font-semibold text-white">{activeTeam?.name ?? "No team"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Database mode</dt>
              <dd className="font-semibold capitalize text-white">
                {boardData.capabilities.schemaMode === "workOwnership"
                  ? "Work ownership"
                  : "Legacy tracker"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Invite code</dt>
              <dd className="text-right font-mono font-semibold text-white">
                {activeTeam?.inviteCode || "Migration required"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Your role</dt>
              <dd className="font-semibold capitalize text-white">
                {currentMember?.role ?? "Unknown"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Blockers", boardData.capabilities.supportsBlockers],
              ["Notes", boardData.capabilities.supportsNotes],
              ["Audit log", boardData.capabilities.supportsActivityLog],
            ].map(([label, active]) => (
              <div
                key={String(label)}
                className={
                  active
                    ? "rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3"
                    : "rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                }
              >
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className={active ? "mt-1 text-xs text-emerald-100" : "mt-1 text-xs text-slate-400"}>
                  {active ? "Available" : "Needs migration"}
                </p>
              </div>
            ))}
          </div>

          {boardData.capabilities.schemaMode === "legacy" ? (
            <p className="mt-5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-50">
              Apply <span className="font-mono">supabase/migrations/20260521_work_ownership_tracker.sql</span> with Supabase admin access to enable the full production database.
            </p>
          ) : null}

          <button
            type="button"
            onClick={copyInviteLink}
            className="mt-5 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Copy invite link
          </button>
        </section>
      );
    }

    if (pathname.endsWith("/settings/profile")) {
      return (
        <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-5">
          <h2 className="text-xl font-bold text-white">Profile</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-semibold text-white">{user?.email ?? "Unknown"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Member name</dt>
              <dd className="font-semibold text-white">{currentMember?.name ?? "Unknown"}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={logout}
            className="mt-5 rounded-md border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-100"
          >
            Logout
          </button>
        </section>
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["/app/settings/members", "Members"],
          ["/app/settings/team", "Team"],
          ["/app/settings/profile", "Profile"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 text-lg font-bold text-white hover:border-cyan-300"
          >
            {label}
          </Link>
        ))}
      </div>
    );
  }

  function renderContent() {
    if (pathname.startsWith("/app/dashboard")) return renderDashboard();
    if (pathname.startsWith("/app/settings")) return renderSettings();

    if (pathname.startsWith("/app/my-work")) {
      return (
        <LiveBoard
          mode="my-work"
          targets={boardData.targets}
          members={boardData.members}
          currentMember={currentMember}
          searchQuery={searchQuery}
          busyTargetId={busyTargetId}
          onClaim={(target) => void runTargetAction("claim", target)}
          onComplete={(target) => void runTargetAction("complete", target)}
          onOpenTarget={(target) => setSelectedTargetId(target.id)}
        />
      );
    }

    if (pathname.startsWith("/app/completed")) {
      return (
        <LiveBoard
          mode="completed"
          targets={boardData.targets}
          members={boardData.members}
          currentMember={currentMember}
          searchQuery={searchQuery}
          busyTargetId={busyTargetId}
          onClaim={(target) => void runTargetAction("claim", target)}
          onComplete={(target) => void runTargetAction("complete", target)}
          onOpenTarget={(target) => setSelectedTargetId(target.id)}
        />
      );
    }

    return (
      <LiveBoard
        mode="board"
        targets={boardData.targets}
        members={boardData.members}
        currentMember={currentMember}
        searchQuery={searchQuery}
        busyTargetId={busyTargetId}
        onClaim={(target) => void runTargetAction("claim", target)}
        onComplete={(target) => void runTargetAction("complete", target)}
        onOpenTarget={(target) => setSelectedTargetId(target.id)}
      />
    );
  }

  if (isBooting) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-white">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Real-Time Work Ownership Tracker
          </p>
          <p className="mt-3 text-slate-300">Opening your board...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="hidden">{children}</div>
      <div className="mx-auto grid w-full max-w-[1800px] gap-0 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-slate-800 bg-slate-950/95 p-4 lg:min-h-screen lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 lg:block">
            <Link href="/app/board" className="block">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Work Tracker
              </p>
              <h1 className="mt-2 text-xl font-bold leading-6 text-white">
                Live ownership
              </h1>
            </Link>

            <button
              type="button"
              onClick={() => setIsMenuOpen((value) => !value)}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 lg:mt-5 lg:w-full"
            >
              {activeTeam?.name ?? "Team"}
            </button>
          </div>

          {isMenuOpen ? (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-3">
              <label className="block text-xs font-semibold text-slate-400" htmlFor="team-switcher">
                Switch team
              </label>
              <select
                id="team-switcher"
                value={activeTeamId}
                onChange={(event) => void switchTeam(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <div className="mt-3 grid gap-2 text-sm">
                <Link href="/onboarding" className="rounded-md px-2 py-2 hover:bg-slate-800">
                  Create team
                </Link>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="rounded-md px-2 py-2 text-left hover:bg-slate-800"
                >
                  Invite people
                </button>
                <Link href="/app/settings/members" className="rounded-md px-2 py-2 hover:bg-slate-800">
                  Members
                </Link>
                <Link href="/app/settings/team" className="rounded-md px-2 py-2 hover:bg-slate-800">
                  Team settings
                </Link>
                <Link href="/app/settings/profile" className="rounded-md px-2 py-2 hover:bg-slate-800">
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-md px-2 py-2 text-left text-rose-100 hover:bg-rose-500/10"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : null}

          <nav className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "rounded-md bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950"
                      : "rounded-md px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 hover:text-white"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 grid grid-cols-2 gap-2 text-sm lg:grid-cols-1">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-slate-500">Available</p>
              <p className="mt-1 text-2xl font-bold text-white">{splitTargets.available.length}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-slate-500">My work</p>
              <p className="mt-1 text-2xl font-bold text-white">{splitTargets.myWork.length}</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 p-4 sm:p-6">
          <header className="mb-5 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
                {activeTeam?.name ?? "Team"}
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
                {pathname.startsWith("/app/dashboard")
                  ? "Dashboard"
                  : pathname.startsWith("/app/settings")
                    ? "Settings"
                    : pathname.startsWith("/app/my-work")
                      ? "My Work"
                      : pathname.startsWith("/app/completed")
                        ? "Completed"
                        : "Live Board"}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Signed in as {user?.email ?? "team member"} -{" "}
                {currentMember
                  ? `${currentMember.name} (${currentMember.role})`
                  : "membership loading"}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto]">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                type="search"
                placeholder="Search targets"
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300"
              />
              <button
                type="button"
                onClick={() => setIsCreateOpen((value) => !value)}
                disabled={!canCreateTarget(currentMember)}
                className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                New target
              </button>
            </div>
          </header>

          {message ? (
            <p className="mb-5 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm leading-6 text-amber-50">
              {message}
            </p>
          ) : null}

          <DatabaseModeBanner mode={boardData.capabilities} />

          {isRefreshing ? (
            <p className="mb-5 text-sm text-slate-500">Refreshing board...</p>
          ) : null}

          {isCreateOpen ? (
            <form
              onSubmit={submitTarget}
              className="mb-6 grid gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-4 xl:grid-cols-[1fr_180px_170px_auto]"
            >
              <label className="block text-sm font-semibold text-slate-200">
                Title
                <input
                  value={targetForm.title}
                  onChange={(event) =>
                    setTargetForm((form) => ({ ...form, title: event.target.value }))
                  }
                  required
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-300"
                  placeholder="Prepare weekly report"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-200">
                Priority
                <select
                  value={targetForm.priority}
                  onChange={(event) =>
                    setTargetForm((form) => ({
                      ...form,
                      priority: event.target.value as TargetPriority,
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-300"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-200">
                Due date
                <input
                  value={targetForm.dueDate}
                  onChange={(event) =>
                    setTargetForm((form) => ({ ...form, dueDate: event.target.value }))
                  }
                  type="date"
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-300"
                />
              </label>
              <button
                type="submit"
                disabled={isCreatingTarget}
                className="self-end rounded-md bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingTarget ? "Creating..." : "Create"}
              </button>
              <label className="block text-sm font-semibold text-slate-200 xl:col-span-4">
                Description
                <textarea
                  value={targetForm.description}
                  onChange={(event) =>
                    setTargetForm((form) => ({
                      ...form,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-300"
                  placeholder="What needs to be true for this target to be complete?"
                />
              </label>
            </form>
          ) : null}

          {currentMember ? renderContent() : (
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 text-sm text-slate-400">
              Your team membership is not active. Ask an owner/admin to invite you, or join with an invite code.
            </div>
          )}
        </section>
      </div>

      {selectedTarget ? (
        <TargetDrawer
          target={selectedTarget}
          members={boardData.members}
          activities={boardData.activities}
          notes={boardData.notes}
          capabilities={boardData.capabilities}
          currentMember={currentMember}
          busy={busyTargetId === selectedTarget.id}
          onClose={() => setSelectedTargetId(null)}
          onAction={(action, target, reason) => void runTargetAction(action, target, reason)}
          onAddNote={(target, body) => void addNote(target, body)}
        />
      ) : null}
    </main>
  );
}
