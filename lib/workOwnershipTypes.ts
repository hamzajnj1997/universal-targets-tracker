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
export type RepeatWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
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
  logoDataUrl?: string;
  timezone?: string;
  workingDays?: RepeatWeekday[];
  dateFormat?: "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy-mm-dd";
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
  repeatDays?: RepeatWeekday[];
  repeatCountPerWeek?: number;
  repeatStartDate?: string;
  repeatEndDate?: string;
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

export type MemberMessage = {
  id: string;
  teamId: string;
  senderMemberId: string;
  recipientMemberId: string;
  body: string;
  createdAt: string;
  readAt?: string;
};

export type BoardCapabilities = {
  schemaMode: "workOwnership" | "legacy";
  supportsBlockers: boolean;
  supportsNotes: boolean;
  supportsActivityLog: boolean;
};

export type BoardData = {
  members: TeamMember[];
  targets: WorkTarget[];
  activities: TargetActivity[];
  notes: TargetNote[];
  capabilities: BoardCapabilities;
};

export type DashboardMetrics = {
  availableTargets: number;
  claimedTargets: number;
  blockedTargets: number;
  openTargets: number;
  overdueTargets: number;
  dueTodayTargets: number;
  dueNext7Days: number;
  dueNext14Days: number;
  highPriorityOpenTargets: number;
  completedToday: number;
  completedThisWeek: number;
  staleClaimedTargets: number;
  averageCompletionHours: number | null;
  completionRate: number | null;
  mostActiveMembers: { member: TeamMember; actions: number }[];
  memberWorkload: {
    member: TeamMember;
    activeTargets: number;
    blockedTargets: number;
    completedThisWeek: number;
  }[];
  priorityBreakdown: { priority: TargetPriority; openTargets: number }[];
};

export type AuthenticatedUser = User;
