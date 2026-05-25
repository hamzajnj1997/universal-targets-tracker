"use client";

import type { TeamMember, WorkTarget } from "../../../lib/workOwnershipTypes";
import {
  canClaimTarget,
  canCompleteTarget,
  formatDateLabel,
  formatRelativeTime,
  getTargetDueState,
  memberName,
  statusLabel,
} from "../../../lib/workOwnershipRules";

type TargetCardProps = {
  target: WorkTarget;
  members: TeamMember[];
  currentMember: TeamMember | null;
  busy: boolean;
  onClaim: (target: WorkTarget) => void;
  onComplete: (target: WorkTarget) => void;
  onOpen: (target: WorkTarget) => void;
};

const priorityClasses: Record<WorkTarget["priority"], string> = {
  low: "border-slate-200 bg-slate-100 text-slate-700",
  medium: "border-sky-200 bg-sky-100 text-sky-800",
  high: "border-amber-200 bg-amber-100 text-amber-800",
  urgent: "border-rose-200 bg-rose-100 text-rose-800",
};

const dueStateLabels = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due soon",
  later: "Scheduled",
  none: "",
};

const dueStateClasses = {
  overdue: "border-rose-200 bg-rose-100 text-rose-800",
  today: "border-amber-200 bg-amber-100 text-amber-800",
  soon: "border-sky-200 bg-sky-100 text-sky-800",
  later: "border-slate-200 bg-slate-100 text-slate-700",
  none: "",
};

const statusClasses: Record<WorkTarget["status"], string> = {
  available: "border-cyan-200 bg-cyan-100 text-cyan-800",
  claimed: "border-sky-200 bg-sky-100 text-sky-800",
  blocked: "border-amber-200 bg-amber-100 text-amber-800",
  completed: "border-emerald-200 bg-emerald-100 text-emerald-800",
  archived: "border-slate-200 bg-slate-100 text-slate-700",
};

const statusAccentClasses: Record<WorkTarget["status"], string> = {
  available: "before:bg-cyan-300",
  claimed: "before:bg-sky-300",
  blocked: "before:bg-amber-300",
  completed: "before:bg-emerald-300",
  archived: "before:bg-slate-500",
};

export function TargetCard({
  target,
  members,
  currentMember,
  busy,
  onClaim,
  onComplete,
  onOpen,
}: TargetCardProps) {
  const claimant = memberName(target.claimedById, members);
  const canClaim = canClaimTarget(currentMember, target);
  const canComplete = canCompleteTarget(currentMember, target);
  const dueState = getTargetDueState(target);
  const primaryLabel = canClaim ? "Claim" : canComplete ? "Complete" : "Details";
  const hasSecondaryDetailsAction = canClaim || canComplete;
  const claimAgeLabel = target.claimedAt
    ? `Claimed ${formatRelativeTime(target.claimedAt)}`
    : "Unclaimed";
  const primaryButtonClass = canComplete
    ? "bg-emerald-500 text-white hover:bg-emerald-600"
    : canClaim
      ? "bg-sky-500 text-white hover:bg-sky-600"
      : "bg-slate-900 text-white hover:bg-slate-800";
  const primaryAction = () => {
    if (canClaim) {
      onClaim(target);
      return;
    }

    if (canComplete) {
      onComplete(target);
      return;
    }

    onOpen(target);
  };

  return (
    <article
      className={`group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-2 pl-3 shadow-sm transition before:absolute before:inset-y-0 before:left-0 before:w-1 hover:border-slate-300 hover:shadow-md ${statusAccentClasses[target.status]}`}
    >
      <div className="grid gap-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
          <button
            type="button"
            onClick={() => onOpen(target)}
            className="min-w-0 text-left"
          >
            <h3 className="truncate text-sm font-bold leading-5 text-slate-950 transition group-hover:text-sky-700">
              {target.title}
            </h3>
            <p className="mt-1 truncate text-xs font-medium text-slate-500">
              {claimant} - due {formatDateLabel(target.dueDate)}
            </p>
          </button>

          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${statusClasses[target.status]}`}
            >
              {statusLabel(target.status)}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${priorityClasses[target.priority]}`}
            >
              {target.priority}
            </span>
            {dueState !== "none" ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${dueStateClasses[dueState]}`}
              >
                {dueStateLabels[dueState]}
              </span>
            ) : null}
          </div>
        </div>

        {target.description ? (
          <p className="line-clamp-1 text-xs leading-5 text-slate-500">
            {target.description}
          </p>
        ) : null}

        {target.status === "blocked" ? (
          <p className="line-clamp-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs leading-5 text-amber-800">
            Blocked: {target.blockedReason ?? "No reason recorded."}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-semibold text-slate-500">
            {claimAgeLabel}
          </p>
          <button
            type="button"
            onClick={primaryAction}
            disabled={busy}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${primaryButtonClass}`}
          >
            {busy ? "..." : primaryLabel}
          </button>
          {hasSecondaryDetailsAction ? (
            <button
              type="button"
              onClick={() => onOpen(target)}
              className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Open
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
