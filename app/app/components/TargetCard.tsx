"use client";

import type { DragEvent } from "react";
import type { TeamMember, WorkTarget } from "../../../lib/workOwnershipTypes";
import {
  canClaimTarget,
  canCompleteTarget,
  formatDateLabel,
  formatRelativeTime,
  getTargetDueState,
  memberName,
} from "../../../lib/workOwnershipRules";

type TargetMoveLane = "available" | "my-work" | "completed";
type TargetMoveOption = {
  key: TargetMoveLane;
  label: string;
};

type TargetCardProps = {
  target: WorkTarget;
  members: TeamMember[];
  currentMember: TeamMember | null;
  busy: boolean;
  onClaim: (target: WorkTarget) => void;
  onComplete: (target: WorkTarget) => void;
  onOpen: (target: WorkTarget) => void;
  draggable?: boolean;
  onDragStart?: (target: WorkTarget, event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  moveOptions?: TargetMoveOption[];
  onMove?: (target: WorkTarget, lane: TargetMoveLane) => void;
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
  draggable = false,
  onDragStart,
  onDragEnd,
  moveOptions = [],
  onMove,
}: TargetCardProps) {
  const claimant = memberName(target.claimedById, members);
  const canClaim = canClaimTarget(currentMember, target);
  const canComplete = canCompleteTarget(currentMember, target);
  const dueState = getTargetDueState(target);
  const primaryLabel = canClaim ? "Claim" : canComplete ? "Complete" : "Open";
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
      data-target-card="true"
      data-target-id={target.id}
      tabIndex={0}
      aria-label={`${target.title}. Press Space for ${primaryLabel}.`}
      draggable={draggable && !busy}
      onDragStart={(event) => onDragStart?.(target, event)}
      onDragEnd={onDragEnd}
      title={draggable ? "Drag to move between lanes" : undefined}
      className={`group relative overflow-hidden rounded-md border border-slate-200 bg-white px-2 py-1.5 pl-3 shadow-sm transition before:absolute before:inset-y-0 before:left-0 before:w-1 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${statusAccentClasses[target.status]}`}
    >
      <div className="grid gap-1.5">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <button
            type="button"
            onClick={() => onOpen(target)}
            className="min-w-0 text-left"
            aria-label={`Open ${target.title}`}
          >
            <h3 className="truncate text-sm font-bold leading-5 text-slate-950 transition group-hover:text-sky-700">
              {target.title}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-500">
              <span className="truncate">{claimant}</span>
              <span className="text-slate-300">|</span>
              <span>Due {formatDateLabel(target.dueDate)}</span>
              <span className="text-slate-300">|</span>
              <span>{claimAgeLabel}</span>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
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
            <button
              type="button"
              onClick={primaryAction}
              disabled={busy}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${primaryButtonClass}`}
            >
              {busy ? "..." : primaryLabel}
            </button>
            {moveOptions.length > 0 ? (
              <select
                aria-label={`Move ${target.title}`}
                defaultValue=""
                disabled={busy}
                onChange={(event) => {
                  const lane = event.currentTarget.value as TargetMoveLane;
                  if (!lane) return;
                  onMove?.(target, lane);
                  event.currentTarget.value = "";
                }}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="" disabled>
                  Move
                </option>
                {moveOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>

        {target.status === "blocked" ? (
          <p className="line-clamp-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] leading-5 text-amber-800">
            Blocked: {target.blockedReason ?? "No reason recorded."}
          </p>
        ) : null}
      </div>
    </article>
  );
}
