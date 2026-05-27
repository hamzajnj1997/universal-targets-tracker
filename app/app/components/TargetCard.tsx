"use client";

import type { DragEvent, ReactNode } from "react";
import type { TeamMember, WorkTarget } from "../../../lib/workOwnershipTypes";
import {
  canClaimTarget,
  canCompleteTarget,
  formatDateLabel,
  formatRepeatLabel,
  formatRelativeTime,
  getTargetDueState,
  memberName,
} from "../../../lib/workOwnershipRules";

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
};

const priorityClasses: Record<WorkTarget["priority"], string> = {
  low: "border-slate-200 bg-slate-100 text-slate-700",
  medium: "border-yellow-200 bg-yellow-100 text-yellow-800",
  high: "border-red-200 bg-red-100 text-red-800",
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

const priorityAccentClasses: Record<WorkTarget["priority"], string> = {
  low: "before:bg-slate-300",
  medium: "before:bg-yellow-400",
  high: "before:bg-red-500",
  urgent: "before:bg-rose-600",
};

type CardIconProps = {
  className?: string;
};

function CardIconBase({
  className = "h-3.5 w-3.5",
  children,
}: CardIconProps & { children: ReactNode }) {
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

function CalendarIcon(props: CardIconProps) {
  return (
    <CardIconBase {...props}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
      <rect height="18" rx="2" width="18" x="3" y="4" />
    </CardIconBase>
  );
}

function RepeatIcon(props: CardIconProps) {
  return (
    <CardIconBase {...props}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </CardIconBase>
  );
}

function TimerIcon(props: CardIconProps) {
  return (
    <CardIconBase {...props}>
      <path d="M10 2h4" />
      <path d="M12 14v-4" />
      <circle cx="12" cy="14" r="8" />
    </CardIconBase>
  );
}

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
}: TargetCardProps) {
  const claimant = memberName(target.claimedById, members);
  const claimantInitials = initialsForName(claimant);
  const canClaim = canClaimTarget(currentMember, target);
  const canComplete = canCompleteTarget(currentMember, target);
  const dueState = getTargetDueState(target);
  const primaryLabel = canClaim ? "Claim" : canComplete ? "Complete" : "Open";
  const claimAgeLabel = target.claimedAt
    ? `Claimed ${formatRelativeTime(target.claimedAt)}`
    : "Unclaimed";
  const repeatLabel = formatRepeatLabel(target);
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
      className={`group relative overflow-hidden rounded-md border border-slate-200 bg-white px-3 py-2 pl-4 shadow-sm transition before:absolute before:inset-y-0 before:left-0 before:w-1 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${priorityAccentClasses[target.priority]}`}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span
            title={claimant}
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ring-1 ${
              target.claimedById
                ? "bg-sky-100 text-sky-800 ring-sky-200"
                : "bg-slate-100 text-slate-500 ring-slate-200"
            }`}
          >
            {claimantInitials}
          </span>
          <button
            type="button"
            onClick={() => onOpen(target)}
            className="block min-w-0 flex-1 text-left"
            aria-label={`Open ${target.title}`}
          >
            <h3 className="line-clamp-2 break-words text-sm font-bold leading-5 text-slate-950 transition group-hover:text-sky-700">
              {target.title}
            </h3>
          </button>
        </div>

        <div className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-500">
          <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">Due {formatDateLabel(target.dueDate)}</span>
          </span>
          {repeatLabel ? (
            <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
              <RepeatIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{repeatLabel}</span>
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            <TimerIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{claimAgeLabel}</span>
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={`inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-[9px] font-bold capitalize leading-none ${priorityClasses[target.priority]}`}
          >
            {target.priority}
          </span>
          {dueState !== "none" ? (
            <span
              className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full border px-1.5 text-[9px] font-bold leading-none ${dueStateClasses[dueState]}`}
            >
              {dueStateLabels[dueState]}
            </span>
          ) : null}
          <button
              type="button"
              onClick={primaryAction}
              disabled={busy}
            className={`ml-auto inline-flex h-8 shrink-0 items-center rounded-md px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${primaryButtonClass}`}
          >
            {busy ? "..." : primaryLabel}
          </button>
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
