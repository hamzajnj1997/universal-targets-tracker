"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  addTargetNote,
  archiveTarget,
  blockTarget,
  claimTarget,
  completeTarget,
  createTarget,
  createTeam,
  forceReleaseTarget,
  getClientForRealtime,
  getCurrentUser,
  inviteMemberByEmail,
  isValidEmailAddress,
  listTeams,
  loadBoardData,
  normalizeEmail,
  releaseTarget,
  reopenTarget,
  signOut,
} from "../../../lib/workOwnershipApi";
import type {
  BoardData,
  RepeatWeekday,
  TargetPriority,
  Team,
  TeamMember,
  TeamRole,
  WorkTarget,
} from "../../../lib/workOwnershipTypes";
import {
  STALE_CLAIM_HOURS,
  calculateDashboardMetrics,
  canClaimTarget,
  canCompleteTarget,
  canCreateTarget,
  filterTargetsForSearch,
  formatDateLabel,
  formatRelativeTime,
  getFirstRepeatDueDate,
  getNextRepeatDueDate,
  getTargetDueState,
  isManagerRole,
  memberName,
  statusLabel,
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
  repeatDays: RepeatWeekday[];
  repeatStartDate: string;
  repeatEndDate: string;
};

type BoardFocus =
  | "all"
  | "available"
  | "today"
  | "next7"
  | "waiting"
  | "blocked"
  | "stale";
type BoardMoveLane = "available" | "my-work" | "claimed-others" | "blocked" | "completed";

function createDefaultTargetForm(): TargetForm {
  return {
    title: "",
    description: "",
    priority: "medium",
    dueDate: todayISO(),
    repeatDays: [],
    repeatStartDate: "",
    repeatEndDate: "",
  };
}

const repeatWeekdayOptions: { value: RepeatWeekday; label: string; name: string }[] = [
  { value: "mon", label: "M", name: "Monday" },
  { value: "tue", label: "T", name: "Tuesday" },
  { value: "wed", label: "W", name: "Wednesday" },
  { value: "thu", label: "T", name: "Thursday" },
  { value: "fri", label: "F", name: "Friday" },
  { value: "sat", label: "S", name: "Saturday" },
  { value: "sun", label: "S", name: "Sunday" },
];

type ShellIconProps = {
  className?: string;
};

function ShellIconBase({
  className = "h-4 w-4",
  children,
}: ShellIconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

function BoardIcon(props: ShellIconProps) {
  return (
    <ShellIconBase {...props}>
      <path d="M4 5h5v14H4z" />
      <path d="M15 5h5v8h-5z" />
      <path d="M15 17h5v2h-5z" />
    </ShellIconBase>
  );
}

function MyWorkIcon(props: ShellIconProps) {
  return (
    <ShellIconBase {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </ShellIconBase>
  );
}

function CompletedIcon(props: ShellIconProps) {
  return (
    <ShellIconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </ShellIconBase>
  );
}

function AnalyticsIcon(props: ShellIconProps) {
  return (
    <ShellIconBase {...props}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-3" />
    </ShellIconBase>
  );
}

function SettingsIcon(props: ShellIconProps) {
  return (
    <ShellIconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 9c.2.6.8 1 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </ShellIconBase>
  );
}

function BellIcon(props: ShellIconProps) {
  return (
    <ShellIconBase {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </ShellIconBase>
  );
}

const navItems = [
  {
    href: "/app/board",
    label: "Live Board",
    icon: BoardIcon,
  },
  {
    href: "/app/my-work",
    label: "My Work",
    icon: MyWorkIcon,
  },
  {
    href: "/app/completed",
    label: "Completed",
    icon: CompletedIcon,
  },
  {
    href: "/app/dashboard",
    label: "Analytics",
    icon: AnalyticsIcon,
  },
  {
    href: "/app/settings/team",
    label: "Workspace Settings",
    icon: SettingsIcon,
  },
];

const dashboardCardToneClasses = {
  neutral: "border-slate-200 bg-white",
  good: "border-emerald-200 bg-emerald-50",
  warning: "border-amber-200 bg-amber-50",
  danger: "border-rose-200 bg-rose-50",
};

const priorityBarClasses: Record<TargetPriority, string> = {
  urgent: "bg-rose-300",
  high: "bg-amber-300",
  medium: "bg-sky-300",
  low: "bg-slate-400",
};

type DashboardCardTone = keyof typeof dashboardCardToneClasses;

const attentionReasonClasses = {
  overdue: "border-rose-200 bg-rose-100 text-rose-800",
  today: "border-amber-200 bg-amber-100 text-amber-800",
  blocked: "border-amber-200 bg-amber-100 text-amber-800",
  stale: "border-violet-200 bg-violet-100 text-violet-800",
  priority: "border-cyan-200 bg-cyan-100 text-cyan-800",
} as const;

function DatabaseModeBanner({
  mode,
}: {
  mode: BoardData["capabilities"];
}) {
  if (mode.schemaMode === "workOwnership") {
    return null;
  }

  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
      Limited database mode: blockers, notes, invites, and full audit need the Supabase migration.
    </div>
  );
}

function isOpenTarget(target: WorkTarget) {
  return target.status !== "completed" && target.status !== "archived";
}

function isStaleClaimTarget(target: WorkTarget, now = new Date()) {
  if (target.status !== "claimed" || !target.claimedAt) return false;
  const claimedAt = new Date(target.claimedAt).getTime();
  const staleThreshold = now.getTime() - STALE_CLAIM_HOURS * 60 * 60 * 1000;

  return !Number.isNaN(claimedAt) && claimedAt < staleThreshold;
}

function targetMatchesBoardFocus(
  target: WorkTarget,
  focus: BoardFocus,
  now = new Date()
) {
  if (focus === "all") return target.status !== "archived";
  if (focus === "available") return target.status === "available";
  if (focus === "blocked") return target.status === "blocked";
  if (focus === "stale") return isStaleClaimTarget(target, now);
  if (!isOpenTarget(target)) return false;

  const dueState = getTargetDueState(target);
  if (focus === "today") return dueState === "overdue" || dueState === "today";
  if (focus === "next7") return dueState === "soon";
  return dueState === "later" || dueState === "none";
}

function isTypingShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();

  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function getBoardCardElements() {
  if (typeof document === "undefined") return [];

  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-target-card='true']")
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const runTargetActionRef = useRef<
    ((action: TargetDrawerAction, target: WorkTarget, reason?: string) => Promise<void>) | null
  >(null);
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
  const [isRepeatOpen, setIsRepeatOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [boardFocus, setBoardFocus] = useState<BoardFocus>("all");
  const [targetForm, setTargetForm] = useState<TargetForm>(createDefaultTargetForm);
  const [dashboardTimestamp, setDashboardTimestamp] = useState(() => Date.now());
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");
  const [newTeamName, setNewTeamName] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

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
  const boardNow = useMemo(
    () => new Date(dashboardTimestamp),
    [dashboardTimestamp]
  );
  const metrics = useMemo(
    () => calculateDashboardMetrics(boardData, boardNow),
    [boardData, boardNow]
  );
  const attentionCount =
    metrics.blockedTargets +
    metrics.overdueTargets +
    metrics.staleClaimedTargets +
    metrics.highPriorityOpenTargets;
  const accountName = currentMember?.name || user?.email || "Account";
  const accountMeta = currentMember
    ? currentMember.role
    : user?.email
      ? "signed in"
      : "loading";
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "U";
  const isBoardFocusRoute =
    pathname.startsWith("/app/board") || pathname.startsWith("/app/my-work");
  const focusedTargets = useMemo(
    () =>
      isBoardFocusRoute
        ? boardData.targets.filter((target) =>
            targetMatchesBoardFocus(target, boardFocus, boardNow)
          )
        : boardData.targets,
    [boardData.targets, boardFocus, boardNow, isBoardFocusRoute]
  );
  const visibleTargets = useMemo(
    () => filterTargetsForSearch(focusedTargets, searchQuery),
    [focusedTargets, searchQuery]
  );
  const focusOptions = useMemo(() => {
    const activeTargets = boardData.targets.filter((target) => target.status !== "archived");
    const countFocus = (focus: BoardFocus) =>
      boardData.targets.filter((target) => targetMatchesBoardFocus(target, focus, boardNow))
        .length;

    return [
      { key: "all" as const, label: "All", count: activeTargets.length },
      { key: "available" as const, label: "Available", count: countFocus("available") },
      { key: "today" as const, label: "Today", count: countFocus("today") },
      { key: "next7" as const, label: "Next 7", count: countFocus("next7") },
      { key: "waiting" as const, label: "Waiting", count: countFocus("waiting") },
      { key: "blocked" as const, label: "Blocked", count: countFocus("blocked") },
      { key: "stale" as const, label: "Stale", count: countFocus("stale") },
    ];
  }, [boardData.targets, boardNow]);
  const sidebarTextClass = "lg:hidden lg:group-hover:block lg:group-focus-within:block";
  const sidebarLabelClass =
    "lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100";
  const sidebarHoverPanelClass =
    "lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100";
  const refreshBoard = useCallback(
    async (teamId = activeTeamId) => {
      if (!teamId) return;
      setIsRefreshing(true);
      try {
        const data = await loadBoardData(teamId);
        setBoardData(data);
        setDashboardTimestamp(Date.now());
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
    let channel = supabase
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
          table: "workspace_members",
          filter: `workspace_id=eq.${activeTeamId}`,
        },
        refresh
      );

    if (boardData.capabilities.supportsActivityLog) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "target_activity",
          filter: `workspace_id=eq.${activeTeamId}`,
        },
        refresh
      );
    }

    if (boardData.capabilities.supportsNotes) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "target_notes",
          filter: `workspace_id=eq.${activeTeamId}`,
        },
        refresh
      );
    }

    if (boardData.capabilities.schemaMode === "legacy") {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "progress_logs",
          filter: `workspace_id=eq.${activeTeamId}`,
        },
        refresh
      );
    }

    channel.subscribe();

    const fallbackRefresh = window.setInterval(refresh, 45000);

    return () => {
      window.clearInterval(fallbackRefresh);
      void supabase.removeChannel(channel);
    };
  }, [
    activeTeamId,
    boardData.capabilities.schemaMode,
    boardData.capabilities.supportsActivityLog,
    boardData.capabilities.supportsNotes,
    refreshBoard,
  ]);

  useEffect(() => {
    runTargetActionRef.current = runTargetAction;
  });

  useEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      if (isCreateOpen) {
        if (event.key === "Escape" && !isCreatingTarget) {
          event.preventDefault();
          setIsCreateOpen(false);
          setIsRepeatOpen(false);
        }
        return;
      }

      if (isTypingShortcutTarget(event.target)) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (
        event.key.toLowerCase() === "c" &&
        isBoardFocusRoute &&
        !selectedTargetId &&
        canCreateTarget(currentMember)
      ) {
        event.preventDefault();
        setSearchQuery("");
        setTargetForm(createDefaultTargetForm());
        setIsRepeatOpen(false);
        setIsCreateOpen(true);
        return;
      }

      if (!isBoardFocusRoute || selectedTargetId) return;

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft"
      ) {
        const cards = getBoardCardElements();
        if (cards.length === 0) return;

        event.preventDefault();
        const activeCard =
          document.activeElement instanceof HTMLElement
            ? document.activeElement.closest<HTMLElement>("[data-target-card='true']")
            : null;
        const currentIndex = activeCard ? cards.indexOf(activeCard) : -1;
        const direction =
          event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const nextIndex =
          currentIndex === -1
            ? 0
            : (currentIndex + direction + cards.length) % cards.length;
        cards[nextIndex]?.focus();
        return;
      }

      if (event.key === " " || event.code === "Space") {
        if (busyTargetId) return;
        const activeElement = document.activeElement;
        if (
          !(activeElement instanceof HTMLElement) ||
          activeElement.dataset.targetCard !== "true"
        ) {
          return;
        }

        const targetId = activeElement.dataset.targetId;
        const target = visibleTargets.find((item) => item.id === targetId);
        if (!target) return;

        event.preventDefault();
        if (canClaimTarget(currentMember, target)) {
          void runTargetActionRef.current?.("claim", target);
          return;
        }

        if (canCompleteTarget(currentMember, target)) {
          void runTargetActionRef.current?.("complete", target);
          return;
        }

        setSelectedTargetId(target.id);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  }, [
    busyTargetId,
    currentMember,
    isCreateOpen,
    isCreatingTarget,
    isBoardFocusRoute,
    selectedTargetId,
    visibleTargets,
  ]);

  async function switchTeam(teamId: string) {
    setActiveTeamId(teamId);
    window.localStorage.setItem(ACTIVE_TEAM_KEY, teamId);
    await refreshBoard(teamId);
    setIsMenuOpen(false);
  }

  async function createTeamFromMenu(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTeamName = newTeamName.trim();
    if (normalizedTeamName.length < 2) {
      setMessage("Team name must be at least 2 characters.");
      return;
    }

    setIsCreatingTeam(true);
    setMessage("");

    try {
      const createdTeam = await createTeam(normalizedTeamName);
      setTeams((currentTeams) => [
        createdTeam,
        ...currentTeams.filter((team) => team.id !== createdTeam.id),
      ]);
      setActiveTeamId(createdTeam.id);
      window.localStorage.setItem(ACTIVE_TEAM_KEY, createdTeam.id);
      setNewTeamName("");
      setIsMenuOpen(false);
      router.push("/app/board");
      await refreshBoard(createdTeam.id);
      setMessage(`Created ${createdTeam.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Team creation failed.");
    } finally {
      setIsCreatingTeam(false);
    }
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

  function toggleCreateTargetForm() {
    setIsCreateOpen((value) => {
      const nextValue = !value;
      if (nextValue) {
        setTargetForm(createDefaultTargetForm());
        setIsRepeatOpen(false);
      }
      return nextValue;
    });
  }

  function closeCreateTargetForm() {
    setIsCreateOpen(false);
    setIsRepeatOpen(false);
  }

  async function submitTarget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTeam || !canCreateTarget(currentMember)) return;

    if (!targetForm.title.trim()) {
      setMessage("Target title is required.");
      return;
    }

    setIsCreatingTarget(true);
    setMessage("");

    try {
      const hasRepeat = targetForm.repeatDays.length > 0;
      const repeatStartDate =
        hasRepeat ? targetForm.repeatStartDate || targetForm.dueDate || todayISO() : "";
      const repeatEndDate = hasRepeat ? targetForm.repeatEndDate : "";

      if (repeatEndDate && repeatEndDate < repeatStartDate) {
        setMessage("Repeat end date must be on or after the start date.");
        return;
      }

      const firstRepeatDueDate = hasRepeat
        ? getFirstRepeatDueDate(targetForm.repeatDays, repeatStartDate)
        : undefined;

      if (hasRepeat && !firstRepeatDueDate) {
        setMessage("Choose at least one repeat day.");
        return;
      }

      if (firstRepeatDueDate && repeatEndDate && firstRepeatDueDate > repeatEndDate) {
        setMessage("No selected repeat day falls inside the start and end dates.");
        return;
      }

      const createdTarget = await createTarget({
        teamId: activeTeam.id,
        title: targetForm.title,
        description: targetForm.description,
        priority: targetForm.priority,
        dueDate: (firstRepeatDueDate ?? targetForm.dueDate) || undefined,
        repeatDays: targetForm.repeatDays,
        repeatStartDate: hasRepeat ? repeatStartDate : undefined,
        repeatEndDate: repeatEndDate || undefined,
      });
      mergeTargetIntoBoard(createdTarget);
      setTargetForm(createDefaultTargetForm());
      closeCreateTargetForm();
      await refreshBoard(activeTeam.id);
      mergeTargetIntoBoard(createdTarget);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Target creation failed.");
    } finally {
      setIsCreatingTarget(false);
    }
  }

  async function createNextRepeatTarget(target: WorkTarget) {
    const nextDueDate = getNextRepeatDueDate(target);
    if (!target.repeatDays?.length) return null;
    if (!nextDueDate) {
      setMessage("Completed. Repeat schedule ended.");
      return null;
    }

    try {
      const nextTarget = await createTarget({
        teamId: target.teamId,
        title: target.title,
        description: target.description,
        priority: target.priority,
        dueDate: nextDueDate,
        repeatDays: target.repeatDays,
        repeatStartDate: target.repeatStartDate,
        repeatEndDate: target.repeatEndDate,
      });

      mergeTargetIntoBoard(nextTarget);
      setMessage(`Completed. Next repeat scheduled for ${formatDateLabel(nextDueDate)}.`);

      return nextTarget;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Completed, but the next repeat was not scheduled: ${error.message}`
          : "Completed, but the next repeat was not scheduled."
      );
      return null;
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
      if (action === "complete" && updatedTarget) {
        await createNextRepeatTarget(target);
      }
      await refreshBoard(target.teamId);
      if (updatedTarget) mergeTargetIntoBoard(updatedTarget);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Target action failed.");
    } finally {
      setBusyTargetId(null);
    }
  }

  async function moveTargetToLane(target: WorkTarget, lane: BoardMoveLane) {
    if (lane === "claimed-others" || lane === "blocked") return;

    setBusyTargetId(target.id);
    setMessage("");

    try {
      let updatedTarget: WorkTarget | null = null;
      const moveReason = "Moved from the Live Board.";
      const isManager = isManagerRole(currentMember?.role);

      if (lane === "my-work") {
        if (target.status === "available") {
          updatedTarget = await claimTarget(target.id);
        } else if (target.status === "completed") {
          updatedTarget = await reopenTarget(target.id);
          mergeTargetIntoBoard(updatedTarget);
          updatedTarget = await claimTarget(target.id);
        }
      }

      if (lane === "available") {
        if (target.status === "completed") {
          updatedTarget = await reopenTarget(target.id);
        } else if (target.status === "claimed" && target.claimedById === currentMember?.id) {
          updatedTarget = await releaseTarget(target.id, moveReason);
        } else if (
          (target.status === "claimed" || target.status === "blocked") &&
          isManager
        ) {
          updatedTarget = await forceReleaseTarget(target.id, moveReason);
        }
      }

      if (lane === "completed") {
        if (target.status === "claimed" || target.status === "blocked") {
          updatedTarget = await completeTarget(target.id);
        }
      }

      if (!updatedTarget) {
        throw new Error("That move is not available for this target.");
      }

      mergeTargetIntoBoard(updatedTarget);
      if (lane === "completed") {
        await createNextRepeatTarget(target);
      }
      await refreshBoard(target.teamId);
      mergeTargetIntoBoard(updatedTarget);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Target move failed.");
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
    const normalizedEmail = normalizeEmail(inviteEmail);
    if (!isValidEmailAddress(normalizedEmail)) {
      setMessage("Enter a valid member email address.");
      return;
    }
    setInviteEmail(normalizedEmail);

    try {
      await inviteMemberByEmail({
        teamId: activeTeam.id,
        email: normalizedEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      await refreshBoard(activeTeam.id);
      setMessage(
        "Invite prepared. If they already have an account, their team access will activate on next sign-in. Otherwise share the invite link too."
      );
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
    const metricCards: {
      label: string;
      value: number | string;
      detail: string;
      tone: DashboardCardTone;
    }[] = [
      {
        label: "Open targets",
        value: metrics.openTargets,
        detail: `${metrics.availableTargets} available`,
        tone: "neutral" as const,
      },
      {
        label: "Claimed now",
        value: metrics.claimedTargets,
        detail: `${metrics.staleClaimedTargets} stale`,
        tone: metrics.staleClaimedTargets > 0 ? "warning" : "neutral",
      },
      {
        label: "Blocked",
        value: metrics.blockedTargets,
        detail: "Needs owner attention",
        tone: metrics.blockedTargets > 0 ? "danger" : "neutral",
      },
      {
        label: "Overdue",
        value: metrics.overdueTargets,
        detail: `${metrics.dueTodayTargets} due today`,
        tone: metrics.overdueTargets > 0 ? "danger" : "good",
      },
      {
        label: "Due next 7 days",
        value: metrics.dueNext7Days,
        detail: `${metrics.dueNext14Days} due next 14`,
        tone: metrics.dueNext7Days > 0 ? "warning" : "neutral",
      },
      {
        label: "High priority open",
        value: metrics.highPriorityOpenTargets,
        detail: "High and urgent",
        tone: metrics.highPriorityOpenTargets > 0 ? "warning" : "neutral",
      },
      {
        label: "Completed today",
        value: metrics.completedToday,
        detail: `${metrics.completedThisWeek} this week`,
        tone: "good" as const,
      },
      {
        label: "Completion rate",
        value:
          metrics.completionRate === null
            ? "n/a"
            : `${Math.round(metrics.completionRate)}%`,
        detail:
          metrics.averageCompletionHours === null
            ? "No cycle time yet"
            : `${metrics.averageCompletionHours.toFixed(1)}h avg`,
        tone: "neutral" as const,
      },
    ];
    const largestPriorityCount = Math.max(
      1,
      ...metrics.priorityBreakdown.map((entry) => entry.openTargets)
    );
    type AttentionItem = {
      target: WorkTarget;
      reason: string;
      detail: string;
      className: string;
      rank: number;
    };
    const staleThreshold =
      boardNow.getTime() - STALE_CLAIM_HOURS * 60 * 60 * 1000;
    const attentionItems = boardData.targets
      .filter((target) => target.status !== "completed" && target.status !== "archived")
      .map<AttentionItem | null>((target) => {
        const dueState = getTargetDueState(target);
        const claimedAt = target.claimedAt ? new Date(target.claimedAt).getTime() : null;
        const isStale =
          target.status === "claimed" &&
          claimedAt !== null &&
          !Number.isNaN(claimedAt) &&
          claimedAt < staleThreshold;
        const owner = memberName(target.claimedById, boardData.members, "Unassigned");
        const detail = `${statusLabel(target.status)} - ${owner} - due ${formatDateLabel(
          target.dueDate
        )}`;

        if (target.status === "blocked") {
          return {
            target,
            reason: "Blocked",
            detail,
            className: attentionReasonClasses.blocked,
            rank: 0,
          };
        }
        if (dueState === "overdue") {
          return {
            target,
            reason: "Overdue",
            detail,
            className: attentionReasonClasses.overdue,
            rank: 1,
          };
        }
        if (dueState === "today") {
          return {
            target,
            reason: "Due today",
            detail,
            className: attentionReasonClasses.today,
            rank: 2,
          };
        }
        if (isStale) {
          return {
            target,
            reason: `Claimed ${formatRelativeTime(target.claimedAt)}`,
            detail,
            className: attentionReasonClasses.stale,
            rank: 3,
          };
        }
        if (target.priority === "urgent" || target.priority === "high") {
          return {
            target,
            reason: target.priority === "urgent" ? "Urgent" : "High priority",
            detail,
            className: attentionReasonClasses.priority,
            rank: 4,
          };
        }

        return null;
      })
      .filter((item): item is AttentionItem => item !== null)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8);
    const completionRatePercent =
      metrics.completionRate === null ? 0 : Math.round(metrics.completionRate);
    const atRiskCount =
      metrics.blockedTargets + metrics.overdueTargets + metrics.staleClaimedTargets;
    const pulseTone =
      atRiskCount > 0
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
    const pipelineItems = [
      {
        label: "Available",
        value: metrics.availableTargets,
        className: "border-cyan-200 bg-cyan-50 text-cyan-800",
      },
      {
        label: "Claimed",
        value: metrics.claimedTargets,
        className: "border-sky-200 bg-sky-50 text-sky-800",
      },
      {
        label: "Blocked",
        value: metrics.blockedTargets,
        className: "border-amber-200 bg-amber-50 text-amber-800",
      },
      {
        label: "Completed today",
        value: metrics.completedToday,
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      },
    ];
    const commandActions = [
      {
        label: "Review blockers",
        count: metrics.blockedTargets,
        detail: "Blocked work",
        focus: "blocked" as const,
        className: "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300",
      },
      {
        label: "Due now",
        count: metrics.overdueTargets + metrics.dueTodayTargets,
        detail: "Overdue and today",
        focus: "today" as const,
        className: "border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-300",
      },
      {
        label: "Check stale claims",
        count: metrics.staleClaimedTargets,
        detail: `Over ${STALE_CLAIM_HOURS}h claimed`,
        focus: "stale" as const,
        className: "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300",
      },
      {
        label: "Assign available",
        count: metrics.availableTargets,
        detail: "Ready to claim",
        focus: "available" as const,
        className: "border-cyan-200 bg-cyan-50 text-cyan-900 hover:border-cyan-300",
      },
    ].filter((action) => action.count > 0);

    return (
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">Operations pulse</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${pulseTone}`}>
                  {atRiskCount > 0 ? `${atRiskCount} at risk` : "On track"}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${Math.max(4, completionRatePercent)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-2xl font-black text-slate-950">
                  {completionRatePercent}%
                </p>
                <p className="text-xs font-bold text-slate-500">Complete</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-2xl font-black text-slate-950">
                  {metrics.completedThisWeek}
                </p>
                <p className="text-xs font-bold text-slate-500">Week</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-2xl font-black text-slate-950">
                  {metrics.averageCompletionHours === null
                    ? "-"
                    : metrics.averageCompletionHours.toFixed(1)}
                </p>
                <p className="text-xs font-bold text-slate-500">Avg hrs</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {pipelineItems.map((item) => (
              <div
                key={item.label}
                className={`rounded-md border px-4 py-3 ${item.className}`}
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-80">
                  {item.label}
                </p>
                <p className="mt-1 text-3xl font-black">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">
                Action queue
              </h3>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                {commandActions.length}
              </span>
            </div>
            {commandActions.length === 0 ? (
              <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                No immediate action needed.
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {commandActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setBoardFocus(action.focus);
                      router.push("/app/board");
                    }}
                    className={`rounded-md border px-3 py-2 text-left transition ${action.className}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{action.label}</span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-black">
                        {action.count}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs font-semibold opacity-75">
                      {action.detail}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-lg border p-4 ${dashboardCardToneClasses[card.tone]}`}
            >
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{card.value}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">{card.detail}</p>
            </div>
          ))}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Needs attention</h2>
              <p className="text-sm leading-6 text-slate-500">
                Blocked, overdue, urgent, and stale work in one place.
              </p>
            </div>
            <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
              {attentionItems.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {attentionItems.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  No urgent attention needed.
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-700">
                  The team has no blocked, overdue, stale, or urgent open work right now.
                </p>
              </div>
            ) : (
              attentionItems.map((item) => (
                <button
                  key={item.target.id}
                  type="button"
                  onClick={() => setSelectedTargetId(item.target.id)}
                  className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-left transition hover:border-slate-300 hover:bg-white sm:grid-cols-[1fr_auto]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-950">
                      {item.target.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {item.detail}
                    </span>
                  </span>
                  <span
                    className={`h-fit w-fit rounded-full border px-3 py-1 text-xs font-bold ${item.className}`}
                  >
                    {item.reason}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Member workload</h2>
            <div className="mt-4 grid gap-3">
              {metrics.memberWorkload.length === 0 ? (
                <p className="text-sm text-slate-500">No owned work yet.</p>
              ) : (
                metrics.memberWorkload.map((entry) => (
                  <div
                    key={entry.member.id}
                    className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-[1fr_auto_auto_auto]"
                  >
                    <span className="font-semibold text-slate-950">{entry.member.name}</span>
                    <span className="text-sm text-slate-500">
                      {entry.activeTargets} active
                    </span>
                    <span className="text-sm text-amber-700">
                      {entry.blockedTargets} blocked
                    </span>
                    <span className="text-sm text-emerald-700">
                      {entry.completedThisWeek} done
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Priority load</h2>
            <div className="mt-4 grid gap-4">
              {metrics.priorityBreakdown.map((entry) => (
                <div
                  key={entry.priority}
                  className="grid gap-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold capitalize text-slate-800">
                      {entry.priority}
                    </span>
                    <span className="text-sm text-slate-500">
                      {entry.openTargets}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${priorityBarClasses[entry.priority]}`}
                      style={{
                        width: `${Math.max(
                          4,
                          (entry.openTargets / largestPriorityCount) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Audit activity</h2>
          <div className="mt-4 grid gap-3">
            {metrics.mostActiveMembers.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet.</p>
            ) : (
              metrics.mostActiveMembers.map((entry) => (
                <div
                  key={entry.member.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="font-semibold text-slate-950">{entry.member.name}</span>
                  <span className="text-sm text-slate-500">{entry.actions} actions</span>
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
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Members</h2>
                <p className="text-sm text-slate-500">
                  Active members can view the board and act through protected RPCs.
                </p>
              </div>
              <button
                type="button"
                onClick={copyInviteLink}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Copy invite link
              </button>
            </div>

            {isManagerRole(currentMember?.role) ? (
              <form
                onSubmit={inviteMember}
                noValidate
                className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
              >
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="member@example.com"
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 outline-none focus:border-sky-400 focus:bg-white"
                />
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as TeamRole)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 outline-none focus:border-sky-400 focus:bg-white"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={!isValidEmailAddress(inviteEmail)}
                  className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Invite
                </button>
              </form>
            ) : null}

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
              {boardData.members.map((member) => (
                <div
                  key={member.id}
                  className="grid gap-2 border-b border-slate-200 bg-slate-50/70 p-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto]"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{member.name}</p>
                    <p className="text-sm text-slate-500">{member.email ?? member.userId ?? "Pending invite"}</p>
                  </div>
                  <span className="h-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-sm capitalize text-slate-700">
                    {member.role}
                  </span>
                  <span className="h-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-sm capitalize text-slate-700">
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
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Team settings</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Team</dt>
              <dd className="font-semibold text-slate-950">{activeTeam?.name ?? "No team"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Database mode</dt>
              <dd className="font-semibold capitalize text-slate-950">
                {boardData.capabilities.schemaMode === "workOwnership"
                  ? "Work ownership"
                  : "Legacy tracker"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Invite code</dt>
              <dd className="text-right font-mono font-semibold text-slate-950">
                {activeTeam?.inviteCode || "Migration required"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Your role</dt>
              <dd className="font-semibold capitalize text-slate-950">
                {currentMember?.role ?? "Unknown"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <p className="text-sm font-bold text-slate-950">Invite link</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <code className="min-w-0 overflow-hidden text-ellipsis rounded-md border border-sky-100 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                {activeTeam?.inviteCode
                  ? `/onboarding?invite=${activeTeam.inviteCode}`
                  : "Apply migration to enable invite links"}
              </code>
              <button
                type="button"
                onClick={copyInviteLink}
                disabled={!activeTeam?.inviteCode}
                className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                Copy link
              </button>
            </div>
          </div>

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
                    ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3"
                    : "rounded-lg border border-slate-200 bg-slate-50 p-3"
                }
              >
                <p className="text-sm font-semibold text-slate-950">{label}</p>
                <p className={active ? "mt-1 text-xs text-emerald-700" : "mt-1 text-xs text-slate-500"}>
                  {active ? "Available" : "Needs migration"}
                </p>
              </div>
            ))}
          </div>

          {boardData.capabilities.schemaMode === "legacy" ? (
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              Apply <span className="font-mono">supabase/migrations/20260521_work_ownership_tracker.sql</span> with Supabase admin access to enable the full production database.
            </p>
          ) : null}

        </section>
      );
    }

    if (pathname.endsWith("/settings/profile")) {
      return (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Profile</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-semibold text-slate-950">{user?.email ?? "Unknown"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Member name</dt>
              <dd className="font-semibold text-slate-950">{currentMember?.name ?? "Unknown"}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={logout}
            className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
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
            className="rounded-lg border border-slate-200 bg-white p-5 text-lg font-bold text-slate-950 shadow-sm hover:border-sky-300"
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
          targets={focusedTargets}
          members={boardData.members}
          currentMember={currentMember}
          searchQuery={searchQuery}
          busyTargetId={busyTargetId}
          onClaim={(target) => void runTargetAction("claim", target)}
          onComplete={(target) => void runTargetAction("complete", target)}
          onOpenTarget={(target) => setSelectedTargetId(target.id)}
          onCreateTarget={canCreateTarget(currentMember) ? toggleCreateTargetForm : undefined}
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
        targets={focusedTargets}
        members={boardData.members}
        currentMember={currentMember}
        searchQuery={searchQuery}
        busyTargetId={busyTargetId}
        onClaim={(target) => void runTargetAction("claim", target)}
        onComplete={(target) => void runTargetAction("complete", target)}
        onOpenTarget={(target) => setSelectedTargetId(target.id)}
        onCreateTarget={canCreateTarget(currentMember) ? toggleCreateTargetForm : undefined}
        onMoveTarget={(target, lane) => void moveTargetToLane(target, lane)}
      />
    );
  }

  if (isBooting) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-950">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
            Real-Time Work Ownership Tracker
          </p>
          <p className="mt-3 text-slate-500">Opening your board...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <div className="hidden">{children}</div>
      <div className="mx-auto grid w-full max-w-[1900px] gap-0 lg:grid-cols-[84px_1fr]">
        <aside className="group border-b border-slate-200 bg-[#132346] p-4 text-white lg:sticky lg:top-0 lg:z-30 lg:flex lg:h-screen lg:w-[84px] lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r lg:border-r-slate-200 lg:transition-[width] lg:duration-200 lg:hover:w-[288px] lg:focus-within:w-[288px]">
          <div className="flex items-center justify-between gap-3 lg:block">
            <Link href="/app/board" className="block">
              <p className={`text-sm font-semibold uppercase tracking-[0.22em] text-sky-200 lg:whitespace-nowrap ${sidebarTextClass}`}>
                Work Tracker
              </p>
              <h1 className={`mt-2 text-xl font-bold leading-6 text-white lg:whitespace-nowrap ${sidebarTextClass}`}>
                Live ownership
              </h1>
              <span className="hidden h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sm font-black text-[#102045] lg:flex lg:group-hover:hidden lg:group-focus-within:hidden">
                W
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setIsMenuOpen((value) => !value)}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:border-sky-200 hover:bg-white/10 lg:mt-5 lg:w-full lg:overflow-hidden lg:whitespace-nowrap"
            >
              <span className={sidebarLabelClass}>
                {activeTeam?.name ?? "Team"}
              </span>
              <span className="hidden lg:inline lg:group-hover:hidden lg:group-focus-within:hidden">
                {activeTeam?.name?.charAt(0).toUpperCase() ?? "T"}
              </span>
            </button>
          </div>

          {isMenuOpen ? (
            <div className={`mt-4 rounded-lg border border-white/10 bg-white/10 p-3 lg:min-w-[256px] ${sidebarHoverPanelClass}`}>
              <label className="block text-xs font-semibold text-slate-300" htmlFor="team-switcher">
                Switch team
              </label>
              <select
                id="team-switcher"
                value={activeTeamId}
                onChange={(event) => void switchTeam(event.target.value)}
                className="mt-2 w-full rounded-md border border-white/15 bg-[#0e1a36] px-3 py-2 text-sm text-white"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <div className="mt-3 grid gap-2 text-sm">
                <form
                  onSubmit={createTeamFromMenu}
                  noValidate
                  className="grid gap-2 rounded-md border border-white/10 bg-white/5 p-2"
                >
                  <label className="text-xs font-semibold text-slate-300" htmlFor="sidebar-team-name">
                    Create team
                  </label>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto] lg:grid-cols-1">
                    <input
                      id="sidebar-team-name"
                      value={newTeamName}
                      onChange={(event) => setNewTeamName(event.target.value)}
                      autoComplete="organization"
                      placeholder="Team name"
                      className="min-w-0 rounded-md border border-white/15 bg-[#0e1a36] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300"
                    />
                    <button
                      type="submit"
                      disabled={isCreatingTeam || newTeamName.trim().length < 2}
                      className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-bold text-[#102045] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingTeam ? "Creating" : "Create"}
                    </button>
                  </div>
                </form>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="rounded-md px-2 py-2 text-left hover:bg-white/10"
                >
                  Invite people
                </button>
                <Link href="/app/settings/members" className="rounded-md px-2 py-2 hover:bg-white/10">
                  Members
                </Link>
                <Link href="/app/settings/team" className="rounded-md px-2 py-2 hover:bg-white/10">
                  Team settings
                </Link>
              </div>
            </div>
          ) : null}

          <nav className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {navItems.map((item) => {
              const isActive = item.href.startsWith("/app/settings")
                ? pathname.startsWith("/app/settings")
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const NavIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  className={
                    isActive
                      ? "rounded-md border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-bold text-[#102045] shadow-sm"
                      : "rounded-md border border-transparent px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/10 hover:bg-white/10 hover:text-white"
                  }
                >
                  <span className="flex items-center gap-2 lg:whitespace-nowrap">
                    <NavIcon className="h-4 w-4 shrink-0" />
                    <span className={sidebarLabelClass}>{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-5">
            <Link
              href="/app/dashboard"
              title="Notifications and attention"
              aria-label={`${attentionCount} items need attention`}
              className="relative flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white lg:whitespace-nowrap"
            >
              <BellIcon className="h-4 w-4 shrink-0" />
              <span className={sidebarLabelClass}>Needs attention</span>
              {attentionCount > 0 ? (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-400 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {attentionCount}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4 lg:mt-auto">
            <div
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2"
              title={`${accountName} - ${accountMeta}`}
            >
              <Link
                href="/app/settings/profile"
                aria-label="Open profile settings"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-black text-[#102045]"
              >
                {accountInitial}
              </Link>
              <div className={`min-w-0 ${sidebarLabelClass}`}>
                <p className="truncate text-sm font-bold text-white">{accountName}</p>
                <p className="truncate text-xs capitalize text-slate-300">{accountMeta}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className={`mt-2 w-full rounded-md px-2 py-2 text-left text-sm font-semibold text-rose-100 transition hover:bg-rose-500/10 lg:whitespace-nowrap ${sidebarLabelClass}`}
            >
              Logout
            </button>
          </div>
        </aside>

        <section className="min-w-0 p-4 sm:p-6">
          <header className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-sky-500">
                  {activeTeam?.name ?? "Team"}
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
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
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  type="search"
                  placeholder="Search work"
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => void refreshBoard()}
                  disabled={!activeTeamId || isRefreshing}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRefreshing ? "Refreshing" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={toggleCreateTargetForm}
                  disabled={!canCreateTarget(currentMember)}
                  className="rounded-md bg-sky-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Create target
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {isBoardFocusRoute
                ? focusOptions.map((option) => {
                    const isActive = boardFocus === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setBoardFocus(option.key)}
                        className={
                          isActive
                            ? "rounded-full border border-sky-700 bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                            : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-sky-400 hover:text-slate-950"
                        }
                      >
                        {option.label}
                        <span className={isActive ? "ml-2 text-sky-100" : "ml-2 text-slate-500"}>
                          {option.count}
                        </span>
                      </button>
                    );
                  })
                : null}
            </div>
          </header>

          {message ? (
            <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
              {message}
            </p>
          ) : null}

          <DatabaseModeBanner mode={boardData.capabilities} />

          {currentMember ? renderContent() : (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
              Your team membership is not active. Ask an owner/admin to invite you, or join with an invite code.
            </div>
          )}
        </section>
      </div>

      {isCreateOpen ? (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-target-title"
        >
          <button
            type="button"
            aria-label="Close create target"
            disabled={isCreatingTarget}
            onClick={closeCreateTargetForm}
            className="absolute inset-0 h-full w-full cursor-default disabled:cursor-not-allowed"
          />
          <form
            onSubmit={submitTarget}
            noValidate
            className="relative z-10 grid max-h-[calc(100vh-2rem)] w-full max-w-2xl gap-4 overflow-y-auto rounded-xl border border-sky-200 bg-white p-5 shadow-2xl"
          >
            <div className="-mx-5 -mt-5 rounded-t-xl border-b border-sky-100 bg-sky-50 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">
                    New work
                  </p>
                  <h2 id="create-target-title" className="mt-1 text-xl font-black text-slate-950">
                    Create target
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeCreateTargetForm}
                  disabled={isCreatingTarget}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>
              </div>
            </div>

            <label className="block text-sm font-semibold text-slate-700">
              Title
              <input
                value={targetForm.title}
                onChange={(event) =>
                  setTargetForm((form) => ({ ...form, title: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-slate-200 bg-sky-50/60 px-3 py-2 text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                placeholder="Prepare weekly report"
                autoFocus
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Finish line
              <textarea
                value={targetForm.description}
                onChange={(event) =>
                  setTargetForm((form) => ({
                    ...form,
                    description: event.target.value,
                  }))
                }
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-200 bg-sky-50/60 px-3 py-2 text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                placeholder="What counts as done?"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Priority
                <select
                  value={targetForm.priority}
                  onChange={(event) =>
                    setTargetForm((form) => ({
                      ...form,
                      priority: event.target.value as TargetPriority,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-200 bg-emerald-50/60 px-3 py-2 text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Due date
                <input
                  value={targetForm.dueDate}
                  onChange={(event) =>
                    setTargetForm((form) => ({ ...form, dueDate: event.target.value }))
                  }
                  type="date"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-amber-50/60 px-3 py-2 text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRepeatOpen((value) => !value);
                    setTargetForm((form) => ({
                      ...form,
                      repeatStartDate: form.repeatStartDate || form.dueDate || todayISO(),
                    }));
                  }}
                  aria-expanded={isRepeatOpen}
                  className="text-sm font-black text-sky-700 transition hover:text-sky-900"
                >
                  {isRepeatOpen
                    ? "Hide repeat schedule"
                    : targetForm.repeatDays.length
                      ? "Edit repeat schedule"
                      : "+ Add repeat schedule"}
                </button>
                <span className="text-xs font-bold text-slate-500">
                  {targetForm.repeatDays.length === 7
                    ? "Daily"
                    : targetForm.repeatDays.length
                      ? `${targetForm.repeatDays.length} times/week`
                      : "One-time"}
                </span>
              </div>

              {isRepeatOpen ? (
                <fieldset className="mt-3 rounded-md border border-sky-100 bg-white px-3 py-3">
                  <legend className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Schedule
                  </legend>
                  <div className="mb-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      Start
                      <input
                        type="date"
                        value={targetForm.repeatStartDate}
                        onChange={(event) =>
                          setTargetForm((form) => ({
                            ...form,
                            repeatStartDate: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 bg-sky-50/70 px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                      />
                    </label>
                    <label className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      End
                      <input
                        type="date"
                        value={targetForm.repeatEndDate}
                        min={targetForm.repeatStartDate || undefined}
                        onChange={(event) =>
                          setTargetForm((form) => ({
                            ...form,
                            repeatEndDate: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 bg-rose-50/60 px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {repeatWeekdayOptions.map((day) => {
                      const isSelected = targetForm.repeatDays.includes(day.value);

                      return (
                        <button
                          key={day.value}
                          type="button"
                          aria-label={`Repeat on ${day.name}`}
                          aria-pressed={isSelected}
                          onClick={() =>
                            setTargetForm((form) => ({
                              ...form,
                              repeatStartDate: form.repeatStartDate || form.dueDate || todayISO(),
                              repeatDays: form.repeatDays.includes(day.value)
                                ? form.repeatDays.filter((value) => value !== day.value)
                                : [...form.repeatDays, day.value],
                            }))
                          }
                          className={
                            isSelected
                              ? "grid h-9 w-9 place-items-center rounded-full bg-sky-600 text-sm font-black text-white shadow-sm transition hover:bg-sky-700"
                              : "grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-sky-50 text-sm font-black text-slate-600 transition hover:border-sky-300 hover:text-sky-700"
                          }
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  {targetForm.repeatDays.length ? (
                    <button
                      type="button"
                      onClick={() =>
                        setTargetForm((form) => ({
                          ...form,
                          repeatDays: [],
                          repeatEndDate: "",
                        }))
                      }
                      className="mt-3 text-xs font-bold text-slate-500 transition hover:text-rose-600"
                    >
                      Remove repeat
                    </button>
                  ) : null}
                </fieldset>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCreateTargetForm}
                disabled={isCreatingTarget}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingTarget || !targetForm.title.trim()}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingTarget ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

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
