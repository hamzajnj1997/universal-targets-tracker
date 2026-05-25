"use client";

import type { TeamMember, WorkTarget } from "../../../lib/workOwnershipTypes";
import {
  filterTargetsForSearch,
  splitBoardTargets,
} from "../../../lib/workOwnershipRules";
import { TargetCard } from "./TargetCard";

type BoardMode = "board" | "my-work" | "completed";

type LiveBoardProps = {
  mode: BoardMode;
  targets: WorkTarget[];
  members: TeamMember[];
  currentMember: TeamMember | null;
  searchQuery: string;
  busyTargetId: string | null;
  onClaim: (target: WorkTarget) => void;
  onComplete: (target: WorkTarget) => void;
  onOpenTarget: (target: WorkTarget) => void;
};

type Section = {
  key: string;
  title: string;
  description: string;
  targets: WorkTarget[];
  accent: string;
  shell: string;
  emptyTitle: string;
  emptyDetail: string;
};

export function LiveBoard({
  mode,
  targets,
  members,
  currentMember,
  searchQuery,
  busyTargetId,
  onClaim,
  onComplete,
  onOpenTarget,
}: LiveBoardProps) {
  const filteredTargets = filterTargetsForSearch(targets, searchQuery);
  const split = splitBoardTargets(filteredTargets, currentMember);

  const sections: Section[] =
    mode === "my-work"
      ? [
          {
            key: "my-work",
            title: "My Work",
            description: "Targets claimed by you, including blocked work.",
            targets: split.myWork,
            accent: "bg-cyan-300",
            shell: "border-sky-100 bg-sky-50/80",
            emptyTitle: "Your queue is clear.",
            emptyDetail: "Claim available work when you are ready to start.",
          },
        ]
      : mode === "completed"
        ? [
            {
              key: "completed",
              title: "Completed",
              description: "Finished targets, newest first.",
              targets: split.completed,
              accent: "bg-emerald-300",
              shell: "border-emerald-100 bg-emerald-50/80",
              emptyTitle: "No completed work yet.",
              emptyDetail: "Completed targets will stay here for review.",
            },
          ]
        : [
            {
              key: "available",
              title: "Available",
              description: "Ready for a member to claim.",
              targets: split.available,
              accent: "bg-cyan-300",
              shell: "border-cyan-100 bg-cyan-50/80",
              emptyTitle: "No open work waiting.",
              emptyDetail: "Create a target when there is something new to do.",
            },
            {
              key: "my-work",
              title: "My Work",
              description: "Targets you own right now.",
              targets: split.myWork,
              accent: "bg-sky-300",
              shell: "border-sky-100 bg-sky-50/80",
              emptyTitle: "Nothing assigned to you.",
              emptyDetail: "Claim an available target to move it into your queue.",
            },
            {
              key: "claimed-others",
              title: "Claimed by Others",
              description: "Work already owned by another member.",
              targets: split.claimedByOthers,
              accent: "bg-violet-300",
              shell: "border-violet-100 bg-violet-50/80",
              emptyTitle: "No one else is holding work.",
              emptyDetail: "Owned work from other team members appears here.",
            },
            {
              key: "blocked",
              title: "Blocked",
              description: "Claimed targets waiting on a blocker.",
              targets: split.blocked,
              accent: "bg-amber-300",
              shell: "border-amber-100 bg-amber-50/80",
              emptyTitle: "No blockers right now.",
              emptyDetail: "Blocked targets will appear here with their reason.",
            },
            {
              key: "completed-today",
              title: "Completed Today",
              description: "Done today and preserved for audit.",
              targets: split.completedToday,
              accent: "bg-emerald-300",
              shell: "border-emerald-100 bg-emerald-50/80",
              emptyTitle: "Nothing completed today yet.",
              emptyDetail: "Finished work will appear here automatically.",
            },
          ];
  const boardGridClass =
    mode === "board"
      ? "grid gap-4 xl:grid-cols-2 2xl:grid-cols-5"
      : "grid gap-4";

  return (
    <div className={boardGridClass}>
      {sections.map((section) => (
        <section
          key={section.key}
          className={`min-w-0 rounded-lg border p-3 shadow-sm ${section.shell}`}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${section.accent}`} />
                <h2 className="text-base font-bold text-slate-950">{section.title}</h2>
              </div>
              <p className="text-xs leading-5 text-slate-500">{section.description}</p>
            </div>
            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
              {section.targets.length}
            </span>
          </div>

          {section.targets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white/75 p-4">
              <p className="text-sm font-semibold text-slate-900">{section.emptyTitle}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {section.emptyDetail}
              </p>
            </div>
          ) : (
            <div className={mode === "board" ? "grid gap-3" : "grid gap-3 lg:grid-cols-2 2xl:grid-cols-3"}>
              {section.targets.map((target) => (
                <TargetCard
                  key={target.id}
                  target={target}
                  members={members}
                  currentMember={currentMember}
                  busy={busyTargetId === target.id}
                  onClaim={onClaim}
                  onComplete={onComplete}
                  onOpen={onOpenTarget}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
