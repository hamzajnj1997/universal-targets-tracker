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
  low: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  medium: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  high: "border-amber-400/40 bg-amber-400/10 text-amber-100",
  urgent: "border-rose-400/40 bg-rose-400/10 text-rose-100",
};

const dueStateLabels = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due soon",
  later: "Scheduled",
  none: "",
};

const dueStateClasses = {
  overdue: "border-rose-400/40 bg-rose-400/10 text-rose-100",
  today: "border-amber-400/40 bg-amber-400/10 text-amber-100",
  soon: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  later: "border-slate-700 bg-slate-900/70 text-slate-200",
  none: "",
};

const statusClasses: Record<WorkTarget["status"], string> = {
  available: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  claimed: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  blocked: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  completed: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
  archived: "border-slate-700 bg-slate-900 text-slate-300",
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
    <article className="group flex min-h-[230px] flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/65 p-3 shadow-sm ring-1 ring-white/[0.03] transition hover:border-slate-700 hover:bg-slate-900">
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
            <h3 className="break-words text-base font-bold leading-6 text-white transition group-hover:text-cyan-100">
              {target.title}
            </h3>
            {target.description ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
                {target.description}
              </p>
            ) : null}
          </button>
        </div>

        <dl className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/45 p-3 text-xs text-slate-300">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Owner</dt>
            <dd className="truncate text-right font-semibold text-slate-100">{claimant}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Claim age</dt>
            <dd className="text-right font-semibold text-slate-100">
              {formatRelativeTime(target.claimedAt)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Due</dt>
            <dd className="text-right font-semibold text-slate-100">
              {formatDateLabel(target.dueDate)}
            </dd>
          </div>
        </dl>

        {target.status === "blocked" ? (
          <p className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
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
          className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Working..." : primaryLabel}
        </button>
        {hasSecondaryDetailsAction ? (
          <button
            type="button"
            onClick={() => onOpen(target)}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            Open
          </button>
        ) : null}
      </div>
    </article>
  );
}
