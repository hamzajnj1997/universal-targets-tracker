import type { User } from "@supabase/supabase-js";

export type TeamRole = "owner" | "admin" | "member";
export type TeamMemberStatus = "active" | "inactive" | "removed";
export type TargetStatus =
  | "available"
  | "claimed"
  | "blocked"
  | "completed"
  | "archived";
export type TargetPriority = "low" | "medium" | "high" | "urgent";
export type TargetActivityAction =
  | "target_created"
  | "target_updated"
  | "target_claimed"
  | "target_released"
  | "target_force_released"
  | "target_blocked"
  | "target_unblocked"
  | "target_completed"
  | "target_reopened"
  | "target_archived"
  | "note_added"
  | "member_invited"
  | "member_joined"
  | "role_changed";

export type Team = {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
};

export type TeamMember = {
  id: string;
  teamId: string;
  userId?: string;
  name: string;
  email?: string;
  role: TeamRole;
  status: TeamMemberStatus;
  joinedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkTarget = {
  id: string;
  teamId: string;
  title: string;
  description: string;
  status: TargetStatus;
  priority: TargetPriority;
  createdById?: string;
  claimedById?: string;
  claimedAt?: string;
  blockedReason?: string;
  blockedAt?: string;
  completedById?: string;
  completedAt?: string;
  dueDate?: string;
  archivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TargetActivity = {
  id: string;
  targetId: string;
  teamId: string;
  actorId?: string;
  action: TargetActivityAction;
  oldStatus?: TargetStatus;
  newStatus?: TargetStatus;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type TargetNote = {
  id: string;
  targetId: string;
  teamId: string;
  userId?: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
};

export type BoardData = {
  members: TeamMember[];
  targets: WorkTarget[];
  activities: TargetActivity[];
  notes: TargetNote[];
};

export type DashboardMetrics = {
  availableTargets: number;
  claimedTargets: number;
  blockedTargets: number;
  completedToday: number;
  completedThisWeek: number;
  staleClaimedTargets: number;
  averageCompletionHours: number | null;
  mostActiveMembers: { member: TeamMember; actions: number }[];
};

export type AuthenticatedUser = User;
