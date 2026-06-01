"use client";

import type {
  TeamMember,
  TargetPriority,
  TargetStatus,
  WorkTarget,
} from "../../../lib/workOwnershipTypes";
import {
  canClaimTarget,
  canCompleteTarget,
  filterTargetsForSearch,
  formatDateLabel,
  formatRelativeTime,
  formatRepeatLabel,
  getTargetDueState,
  memberName,
  statusLabel,
} from "../../../lib/workOwnershipRules";

type TargetListMode = "board" | "my-work" | "completed";

type TargetListViewProps = {
  mode: TargetListMode;
  targets: WorkTarget[];
  members: TeamMember[];
  currentMember: TeamMember | null;
  searchQuery: string;
  busyTargetId: string | null;
  onClaim: (target: WorkTarget) => void;
  onComplete: (target: WorkTarget) => void;
  onOpenTarget: (target: WorkTarget) => void;
  onCreateTarget?: () => void;
};

const statusClasses: Record<TargetStatus, string> = {
  available: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  claimed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  blocked: "bg-amber-50 text-amber-800 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-200",
};

const priorityClasses: Record<TargetPriority, string> = {
  low: "bg-slate-100 text-slate-600 ring-slate-200",
  medium: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  high: "bg-red-50 text-red-700 ring-red-200",
  urgent: "bg-rose-50 text-rose-700 ring-rose-200",
};

const statusRank: Record<TargetStatus, number> = {
  available: 0,
  claimed: 1,
  blocked: 2,
  completed: 3,
  archived: 4,
};

function initialsForName(name: string) {
  const words = name
    .replace(/@.*/, "")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function dueTone(target: WorkTarget) {
  const dueState = getTargetDueState(target);
  if (dueState === "overdue") return "text-rose-700";
  if (dueState === "today") return "text-amber-700";
  if (dueState === "soon") return "text-indigo-700";
  return "text-slate-600";
}

export function TargetListView({
  mode,
  targets,
  members,
  currentMember,
  searchQuery,
  busyTargetId,
  onClaim,
  onComplete,
  onOpenTarget,
  onCreateTarget,
}: TargetListViewProps) {
  const visibleTargets = filterTargetsForSearch(targets, searchQuery)
    .filter((target) => {
      if (mode === "my-work") {
        return target.status === "claimed" && target.claimedById === currentMember?.id;
      }
      if (mode === "completed") return target.status === "completed";
      return target.status !== "archived";
    })
    .sort((left, right) => {
      const statusDelta = statusRank[left.status] - statusRank[right.status];
      if (statusDelta !== 0) return statusDelta;
      return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
    });

  if (visibleTargets.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-8 text-center shadow-[0_10px_30px_rgb(15_23_42_/_0.08)] ring-1 ring-white/80">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
          <svg
            aria-hidden="true"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M8 6h13" />
            <path d="M8 12h13" />
            <path d="M8 18h13" />
            <path d="M3 6h.01" />
            <path d="M3 12h.01" />
            <path d="M3 18h.01" />
          </svg>
        </div>
        <h2 className="mt-4 text-base font-black text-slate-950">
          {searchQuery.trim() ? "No matches found." : "You're all caught up."}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
          {searchQuery.trim()
            ? "Try another owner, title, priority, or due date."
            : "Use Board view to claim available work, or create the next target when the team needs momentum."}
        </p>
        {!searchQuery.trim() && onCreateTarget ? (
          <button
            type="button"
            onClick={onCreateTarget}
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-[0_10px_18px_rgb(79_70_229_/_0.18)] transition hover:-translate-y-0.5 hover:bg-indigo-700"
          >
            Create target
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="overflow-x-auto rounded-2xl bg-white shadow-[0_10px_30px_rgb(15_23_42_/_0.08)] ring-1 ring-white/80">
      <div className="min-w-[830px]">
        <div className="grid grid-cols-[minmax(280px,1.4fr)_120px_160px_150px_120px] gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <span>Target</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Due</span>
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-slate-100">
          {visibleTargets.map((target) => {
            const owner = memberName(target.claimedById, members);
            const canClaim = canClaimTarget(currentMember, target);
            const canComplete = canCompleteTarget(currentMember, target);
            const repeatLabel = formatRepeatLabel(target);
            const actionLabel = canClaim ? "Claim" : canComplete ? "Complete" : "Open";
            const actionClass = canComplete
              ? "bg-emerald-500 text-white hover:bg-emerald-600"
              : canClaim
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-slate-900 text-white hover:bg-slate-800";

            return (
              <article
                key={target.id}
                className="grid grid-cols-[minmax(280px,1.4fr)_120px_160px_150px_120px] items-center gap-3 px-4 py-3 transition hover:bg-indigo-50/40"
              >
                <button
                  type="button"
                  onClick={() => onOpenTarget(target)}
                  className="min-w-0 text-left"
                >
                  <span className="block truncate text-sm font-black text-slate-950">
                    {target.title}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-500">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 capitalize ring-1 ${priorityClasses[target.priority]}`}
                    >
                      {target.priority}
                    </span>
                    {repeatLabel ? <span className="truncate">{repeatLabel}</span> : null}
                    {target.claimedAt ? (
                      <span className="truncate">
                        Claimed {formatRelativeTime(target.claimedAt)}
                      </span>
                    ) : null}
                  </span>
                </button>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusClasses[target.status]}`}
                >
                  {statusLabel(target.status)}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] font-black text-indigo-800 ring-1 ring-indigo-200">
                    {initialsForName(owner)}
                  </span>
                  <span className="truncate text-sm font-bold text-slate-700">{owner}</span>
                </span>
                <span className={`truncate text-sm font-bold ${dueTone(target)}`}>
                  {formatDateLabel(target.dueDate)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (canClaim) {
                      onClaim(target);
                      return;
                    }
                    if (canComplete) {
                      onComplete(target);
                      return;
                    }
                    onOpenTarget(target);
                  }}
                  disabled={busyTargetId === target.id}
                  className={`justify-self-end rounded-lg px-3 py-2 text-xs font-black shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${actionClass}`}
                >
                  {busyTargetId === target.id ? "..." : actionLabel}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
