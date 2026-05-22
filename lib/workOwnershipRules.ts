import type {
  BoardData,
  DashboardMetrics,
  TargetStatus,
  TeamMember,
  TeamRole,
  WorkTarget,
} from "./workOwnershipTypes";

export const STALE_CLAIM_HOURS = 24;

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

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
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

  return {
    available: activeTargets.filter((target) => target.status === "available"),
    myWork: activeTargets.filter(
      (target) =>
        (target.status === "claimed" || target.status === "blocked") &&
        target.claimedById === currentMember?.id
    ),
    claimedByOthers: activeTargets.filter(
      (target) =>
        target.status === "claimed" &&
        Boolean(target.claimedById) &&
        target.claimedById !== currentMember?.id
    ),
    blocked: activeTargets.filter((target) => target.status === "blocked"),
    completedToday: activeTargets.filter(
      (target) =>
        target.status === "completed" &&
        Boolean(target.completedAt) &&
        target.completedAt?.slice(0, 10) === today
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

  return {
    availableTargets: activeTargets.filter((target) => target.status === "available").length,
    claimedTargets: activeTargets.filter((target) => target.status === "claimed").length,
    blockedTargets: activeTargets.filter((target) => target.status === "blocked").length,
    completedToday: completedTargets.filter(
      (target) => target.completedAt?.slice(0, 10) === today
    ).length,
    completedThisWeek: completedTargets.filter((target) => {
      if (!target.completedAt) return false;
      return new Date(target.completedAt).getTime() >= weekStart.getTime();
    }).length,
    staleClaimedTargets: activeTargets.filter((target) => {
      if (target.status !== "claimed" || !target.claimedAt) return false;
      const claimedAt = new Date(target.claimedAt).getTime();
      return !Number.isNaN(claimedAt) && claimedAt < staleThreshold;
    }).length,
    averageCompletionHours:
      durations.length > 0
        ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
        : null,
    mostActiveMembers,
  };
}
