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
  const primaryButtonClass = canComplete
    ? "bg-emerald-500 text-white hover:bg-emerald-600"
    : canClaim
      ? "bg-sky-500 text-white hover:bg-sky-600"
      : "bg-slate-900 text-white hover:bg-slate-800";
  const actionHint = canClaim
    ? "Ready for someone to own."
    : canComplete
      ? "Owned by you. Finish it or open for options."
      : target.status === "blocked"
        ? "Waiting on a blocker."
        : target.status === "completed"
          ? "Finished and kept for audit."
          : "Open for details.";
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
      className={`group relative flex min-h-[230px] flex-col justify-between overflow-hidden rounded-lg border border-slate-200 bg-white p-3 pl-4 shadow-sm transition before:absolute before:inset-y-0 before:left-0 before:w-1 hover:border-slate-300 hover:shadow-md ${statusAccentClasses[target.status]}`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${statusClasses[target.status]}`}
          >
            {statusLabel(target.status)}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${priorityClasses[target.priority]}`}
          >
            {target.priority}
          </span>
          {dueState !== "none" ? (
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${dueStateClasses[dueState]}`}
            >
              {dueStateLabels[dueState]}
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(target)}
            className="block w-full text-left"
          >
            <h3 className="break-words text-base font-bold leading-6 text-slate-950 transition group-hover:text-sky-700">
              {target.title}
            </h3>
            {target.description ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                {target.description}
              </p>
            ) : null}
          </button>
        </div>

        <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-500">
          {actionHint}
        </p>

        <dl className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Owner</dt>
            <dd className="truncate text-right font-semibold text-slate-900">{claimant}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Claim age</dt>
            <dd className="text-right font-semibold text-slate-900">
              {formatRelativeTime(target.claimedAt)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Due</dt>
            <dd className="text-right font-semibold text-slate-900">
              {formatDateLabel(target.dueDate)}
            </dd>
          </div>
        </dl>

        {target.status === "blocked" ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Blocked: {target.blockedReason ?? "No reason recorded."}
          </p>
        ) : null}
      </div>

      <div
        className={
          hasSecondaryDetailsAction
            ? "mt-5 grid grid-cols-[1fr_auto] gap-2"
            : "mt-5 grid gap-2"
        }
      >
        <button
          type="button"
          onClick={primaryAction}
          disabled={busy}
          className={`rounded-md px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${primaryButtonClass}`}
        >
          {busy ? "Working..." : primaryLabel}
        </button>
        {hasSecondaryDetailsAction ? (
          <button
            type="button"
            onClick={() => onOpen(target)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Open
          </button>
        ) : null}
      </div>
    </article>
  );
}
