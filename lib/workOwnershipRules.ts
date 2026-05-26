import type {
  BoardData,
  DashboardMetrics,
  RepeatWeekday,
  TargetPriority,
  TargetStatus,
  TeamMember,
  TeamRole,
  WorkTarget,
} from "./workOwnershipTypes";

export const STALE_CLAIM_HOURS = 24;
export type TargetDueState = "overdue" | "today" | "soon" | "later" | "none";

const repeatDayLabels: Record<RepeatWeekday, string> = {
  mon: "M",
  tue: "T",
  wed: "W",
  thu: "T",
  fri: "F",
  sat: "S",
  sun: "S",
};

const repeatDayIndexes: Record<RepeatWeekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export function isManagerRole(role: TeamRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canCreateTarget(member: TeamMember | null | undefined) {
  return Boolean(member && member.status === "active");
}

export function canClaimTarget(
  member: TeamMember | null | undefined,
  target: WorkTarget
) {
  return Boolean(
    member && member.status === "active" && target.status === "available"
  );
}

export function canReleaseTarget(
  member: TeamMember | null | undefined,
  target: WorkTarget
) {
  return Boolean(
    member &&
      member.status === "active" &&
      target.status === "claimed" &&
      target.claimedById === member.id
  );
}

export function canForceReleaseTarget(
  member: TeamMember | null | undefined,
  target: WorkTarget
) {
  return Boolean(
    member &&
      member.status === "active" &&
      isManagerRole(member.role) &&
      (target.status === "claimed" || target.status === "blocked")
  );
}

export function canBlockTarget(
  member: TeamMember | null | undefined,
  target: WorkTarget
) {
  return Boolean(
    member &&
      member.status === "active" &&
      target.status === "claimed" &&
      target.claimedById === member.id
  );
}

export function canCompleteTarget(
  member: TeamMember | null | undefined,
  target: WorkTarget
) {
  if (!member || member.status !== "active") return false;
  if (target.status !== "claimed" && target.status !== "blocked") return false;
  return target.claimedById === member.id || isManagerRole(member.role);
}

export function canReopenTarget(member: TeamMember | null | undefined) {
  return Boolean(member && member.status === "active" && isManagerRole(member.role));
}

export function canArchiveTarget(member: TeamMember | null | undefined) {
  return Boolean(member && member.status === "active" && isManagerRole(member.role));
}

export function todayISO(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function dateTimeToLocalISO(value: string | Date | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return todayISO(date);
}

export function statusLabel(status: TargetStatus) {
  const labels: Record<TargetStatus, string> = {
    available: "Available",
    claimed: "Claimed",
    blocked: "Blocked",
    completed: "Completed",
    archived: "Archived",
  };

  return labels[status];
}

export function formatDateLabel(date: string | undefined) {
  if (!date) return "No due date";

  const parsed = parseLocalDate(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatRepeatLabel(target: WorkTarget) {
  const repeatDays = target.repeatDays ?? [];
  if (!repeatDays.length) return "";

  const count = target.repeatCountPerWeek ?? repeatDays.length;
  const dayLabel = repeatDays.map((day) => repeatDayLabels[day]).join(" ");

  return `${count}x/week ${dayLabel}`;
}

export function formatRepeatWindowLabel(target: WorkTarget) {
  if (!target.repeatDays?.length) return "";
  const start = target.repeatStartDate ? formatDateLabel(target.repeatStartDate) : "No start";
  const end = target.repeatEndDate ? formatDateLabel(target.repeatEndDate) : "No end";

  return `${start} to ${end}`;
}

export function getFirstRepeatDueDate(
  repeatDays: RepeatWeekday[],
  startDate: string | undefined,
  now = new Date()
) {
  if (!repeatDays.length) return undefined;

  const selectedDays = new Set(repeatDays.map((day) => repeatDayIndexes[day]));
  const parsedStart = parseLocalDate(startDate);
  const today = parseLocalDate(todayISO(now));
  const baseDate =
    Number.isNaN(parsedStart.getTime()) || parsedStart < today ? today : parsedStart;

  for (let offset = 0; offset <= 13; offset += 1) {
    const candidate = new Date(baseDate);
    candidate.setDate(baseDate.getDate() + offset);

    if (selectedDays.has(candidate.getDay())) {
      return todayISO(candidate);
    }
  }

  return undefined;
}

export function getNextRepeatDueDate(target: WorkTarget, now = new Date()) {
  const repeatDays = target.repeatDays ?? [];
  if (!repeatDays.length) return undefined;

  const selectedDays = new Set(repeatDays.map((day) => repeatDayIndexes[day]));
  const dueDate = parseLocalDate(target.dueDate);
  const today = parseLocalDate(todayISO(now));
  const baseDate = Number.isNaN(dueDate.getTime()) || dueDate < today ? today : dueDate;

  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = new Date(baseDate);
    candidate.setDate(baseDate.getDate() + offset);

    if (selectedDays.has(candidate.getDay())) {
      const candidateDate = todayISO(candidate);
      if (target.repeatEndDate && candidateDate > target.repeatEndDate) {
        return undefined;
      }

      return candidateDate;
    }
  }

  return undefined;
}

function parseLocalDate(date: string | undefined) {
  if (!date) return new Date(Number.NaN);

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return new Date(Number.NaN);

  return new Date(year, month - 1, day);
}

function dayOffsetFrom(date: string | undefined, now: Date) {
  const parsed = parseLocalDate(date);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = parseLocalDate(todayISO(now));
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
}

export function getTargetDueState(
  target: WorkTarget,
  now = new Date()
): TargetDueState {
  if (target.status === "completed" || target.status === "archived") return "none";

  const offset = dayOffsetFrom(target.dueDate, now);
  if (offset === null) return "none";
  if (offset < 0) return "overdue";
  if (offset === 0) return "today";
  if (offset <= 7) return "soon";
  return "later";
}

function priorityRank(priority: TargetPriority) {
  const ranks: Record<TargetPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return ranks[priority];
}

function targetDateTime(value: string | undefined, fallback = 0) {
  if (!value) return fallback;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? fallback : parsed;
}

function sortTargetsByUrgency(targets: WorkTarget[], now: Date) {
  return [...targets].sort((a, b) => {
    const aOffset = dayOffsetFrom(a.dueDate, now);
    const bOffset = dayOffsetFrom(b.dueDate, now);
    const aDueRank = aOffset === null ? Number.MAX_SAFE_INTEGER : aOffset;
    const bDueRank = bOffset === null ? Number.MAX_SAFE_INTEGER : bOffset;

    return (
      aDueRank - bDueRank ||
      priorityRank(a.priority) - priorityRank(b.priority) ||
      targetDateTime(b.updatedAt ?? b.createdAt) -
        targetDateTime(a.updatedAt ?? a.createdAt)
    );
  });
}

export function formatRelativeTime(value: string | undefined) {
  if (!value) return "Not claimed";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  for (const item of units) {
    if (seconds >= item.seconds) {
      return formatter.format(-Math.floor(seconds / item.seconds), item.unit);
    }
  }

  return "Just now";
}

export function memberName(
  memberId: string | undefined,
  members: TeamMember[],
  fallback = "Unassigned"
) {
  if (!memberId) return fallback;
  return members.find((member) => member.id === memberId)?.name ?? "Unknown member";
}

export function filterTargetsForSearch(targets: WorkTarget[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return targets;

  return targets.filter((target) =>
    [target.title, target.description, target.status, target.priority, target.dueDate]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );
}

export function splitBoardTargets(
  targets: WorkTarget[],
  currentMember: TeamMember | null,
  now = new Date()
) {
  const today = todayISO(now);
  const activeTargets = targets.filter((target) => target.status !== "archived");
  const completedTargets = activeTargets
    .filter((target) => target.status === "completed")
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;

      return bTime - aTime;
    });

  return {
    available: sortTargetsByUrgency(
      activeTargets.filter((target) => target.status === "available"),
      now
    ),
    myWork: sortTargetsByUrgency(
      activeTargets.filter(
        (target) =>
          (target.status === "claimed" || target.status === "blocked") &&
          target.claimedById === currentMember?.id
      ),
      now
    ),
    claimedByOthers: sortTargetsByUrgency(
      activeTargets.filter(
        (target) =>
          target.status === "claimed" &&
          Boolean(target.claimedById) &&
          target.claimedById !== currentMember?.id
      ),
      now
    ),
    blocked: sortTargetsByUrgency(
      activeTargets.filter((target) => target.status === "blocked"),
      now
    ),
    completed: completedTargets,
    completedToday: completedTargets.filter(
      (target) =>
        Boolean(target.completedAt) &&
        dateTimeToLocalISO(target.completedAt) === today
    ),
  };
}

export function calculateDashboardMetrics(
  data: BoardData,
  now = new Date()
): DashboardMetrics {
  const today = todayISO(now);
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const activeTargets = data.targets.filter((target) => target.status !== "archived");
  const completedTargets = activeTargets.filter(
    (target) => target.status === "completed" && target.completedAt
  );
  const openTargets = activeTargets.filter(
    (target) => target.status !== "completed" && target.status !== "archived"
  );
  const staleThreshold = now.getTime() - STALE_CLAIM_HOURS * 60 * 60 * 1000;
  const durations = completedTargets
    .map((target) => {
      if (!target.claimedAt || !target.completedAt) return null;
      const claimed = new Date(target.claimedAt).getTime();
      const completed = new Date(target.completedAt).getTime();
      if (Number.isNaN(claimed) || Number.isNaN(completed) || completed < claimed) {
        return null;
      }
      return (completed - claimed) / 36e5;
    })
    .filter((duration): duration is number => typeof duration === "number");

  const activityByMember = new Map<string, number>();
  for (const activity of data.activities) {
    if (!activity.actorId) continue;
    activityByMember.set(activity.actorId, (activityByMember.get(activity.actorId) ?? 0) + 1);
  }

  const mostActiveMembers = data.members
    .map((member) => ({ member, actions: activityByMember.get(member.id) ?? 0 }))
    .filter((entry) => entry.actions > 0)
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 5);
  const completedThisWeekTargets = completedTargets.filter((target) => {
    if (!target.completedAt) return false;
    return new Date(target.completedAt).getTime() >= weekStart.getTime();
  });
  const priorityOrder: TargetPriority[] = ["urgent", "high", "medium", "low"];
  const priorityBreakdown = priorityOrder.map((priority) => ({
    priority,
    openTargets: openTargets.filter((target) => target.priority === priority).length,
  }));
  const memberWorkload = data.members
    .map((member) => ({
      member,
      activeTargets: activeTargets.filter(
        (target) =>
          target.claimedById === member.id &&
          (target.status === "claimed" || target.status === "blocked")
      ).length,
      blockedTargets: activeTargets.filter(
        (target) => target.claimedById === member.id && target.status === "blocked"
      ).length,
      completedThisWeek: completedThisWeekTargets.filter(
        (target) => target.completedById === member.id || target.claimedById === member.id
      ).length,
    }))
    .filter(
      (entry) =>
        entry.activeTargets > 0 ||
        entry.blockedTargets > 0 ||
        entry.completedThisWeek > 0
    )
    .sort(
      (a, b) =>
        b.activeTargets - a.activeTargets ||
        b.blockedTargets - a.blockedTargets ||
        b.completedThisWeek - a.completedThisWeek
    )
    .slice(0, 8);

  return {
    availableTargets: activeTargets.filter((target) => target.status === "available").length,
    claimedTargets: activeTargets.filter((target) => target.status === "claimed").length,
    blockedTargets: activeTargets.filter((target) => target.status === "blocked").length,
    openTargets: openTargets.length,
    overdueTargets: openTargets.filter((target) => {
      const offset = dayOffsetFrom(target.dueDate, now);
      return offset !== null && offset < 0;
    }).length,
    dueTodayTargets: openTargets.filter((target) => dayOffsetFrom(target.dueDate, now) === 0)
      .length,
    dueNext7Days: openTargets.filter((target) => {
      const offset = dayOffsetFrom(target.dueDate, now);
      return offset !== null && offset >= 0 && offset <= 7;
    }).length,
    dueNext14Days: openTargets.filter((target) => {
      const offset = dayOffsetFrom(target.dueDate, now);
      return offset !== null && offset >= 0 && offset <= 14;
    }).length,
    highPriorityOpenTargets: openTargets.filter(
      (target) => target.priority === "high" || target.priority === "urgent"
    ).length,
    completedToday: completedTargets.filter(
      (target) => dateTimeToLocalISO(target.completedAt) === today
    ).length,
    completedThisWeek: completedThisWeekTargets.length,
    staleClaimedTargets: activeTargets.filter((target) => {
      if (target.status !== "claimed" || !target.claimedAt) return false;
      const claimedAt = new Date(target.claimedAt).getTime();
      return !Number.isNaN(claimedAt) && claimedAt < staleThreshold;
    }).length,
    averageCompletionHours:
      durations.length > 0
        ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
        : null,
    completionRate:
      activeTargets.length > 0
        ? (completedTargets.length / activeTargets.length) * 100
        : null,
    mostActiveMembers,
    memberWorkload,
    priorityBreakdown,
  };
}
