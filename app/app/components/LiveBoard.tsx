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
          },
        ]
      : mode === "completed"
        ? [
            {
              key: "completed",
              title: "Completed Today",
              description: "Targets completed today by the team.",
              targets: split.completedToday,
            },
          ]
        : [
            {
              key: "available",
              title: "Available",
              description: "Ready for a member to claim.",
              targets: split.available,
            },
            {
              key: "my-work",
              title: "My Work",
              description: "Targets you own right now.",
              targets: split.myWork,
            },
            {
              key: "claimed-others",
              title: "Claimed by Others",
              description: "Work already owned by another member.",
              targets: split.claimedByOthers,
            },
            {
              key: "blocked",
              title: "Blocked",
              description: "Claimed targets waiting on a blocker.",
              targets: split.blocked,
            },
            {
              key: "completed-today",
              title: "Completed Today",
              description: "Done today and preserved for audit.",
              targets: split.completedToday,
            },
          ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.key} className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{section.title}</h2>
              <p className="text-sm leading-6 text-slate-400">{section.description}</p>
            </div>
            <span className="w-fit rounded-full border border-slate-700 px-3 py-1 text-sm font-semibold text-slate-200">
              {section.targets.length}
            </span>
          </div>

          {section.targets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 p-5 text-sm text-slate-400">
              Nothing here right now.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
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
