import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";
import type {
  BoardData,
  TargetActivity,
  TargetActivityAction,
  TargetNote,
  TargetPriority,
  TargetStatus,
  Team,
  TeamMember,
  TeamMemberStatus,
  TeamRole,
  WorkTarget,
} from "./workOwnershipTypes";

type RowRecord = Record<string, unknown>;
type RpcArgs = Record<string, string | number | boolean | null | undefined>;

export type CreateTargetInput = {
  teamId: string;
  title: string;
  description?: string;
  priority: TargetPriority;
  dueDate?: string;
};

export type TeamInviteInput = {
  teamId: string;
  email: string;
  role: TeamRole;
};

export type AuthMode = "login" | "signup" | "forgot";

function requireSupabaseClient(): SupabaseClient {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return supabase;
}

function rows(value: unknown): RowRecord[] {
  return Array.isArray(value) ? value.filter(isRowRecord) : [];
}

function isRowRecord(value: unknown): value is RowRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(row: RowRecord, key: string, fallback = "") {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readOptionalString(row: RowRecord, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readBoolean(row: RowRecord, key: string, fallback = false) {
  return typeof row[key] === "boolean" ? row[key] : fallback;
}

function normalizeRole(value: unknown): TeamRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin" || normalized === "leader" || normalized === "manager") {
    return "admin";
  }
  return "member";
}

function normalizeMemberStatus(value: unknown): TeamMemberStatus {
  if (value === "inactive" || value === "removed") return value;
  return "active";
}

function normalizeTargetStatus(row: RowRecord): TargetStatus {
  const raw = row.status;
  if (
    raw === "available" ||
    raw === "claimed" ||
    raw === "blocked" ||
    raw === "completed" ||
    raw === "archived"
  ) {
    return raw;
  }

  if (readBoolean(row, "is_archived")) return "archived";
  if (readOptionalString(row, "claimed_by_member_id")) return "claimed";
  return "available";
}

function normalizePriority(value: unknown): TargetPriority {
  if (value === "low" || value === "high" || value === "urgent") return value;
  return "medium";
}

function normalizeAction(value: unknown): TargetActivityAction {
  const validActions: TargetActivityAction[] = [
    "target_created",
    "target_updated",
    "target_claimed",
    "target_released",
    "target_force_released",
    "target_blocked",
    "target_unblocked",
    "target_completed",
    "target_reopened",
    "target_archived",
    "note_added",
    "member_invited",
    "member_joined",
    "role_changed",
  ];

  return validActions.includes(value as TargetActivityAction)
    ? (value as TargetActivityAction)
    : "target_updated";
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!isRowRecord(value)) return undefined;
  return value;
}

function toTeam(row: RowRecord): Team {
  return {
    id: readString(row, "id"),
    name: readString(row, "name", "Untitled team"),
    ownerId: readString(row, "owner_id", readString(row, "ownerId")),
    inviteCode: readString(row, "invite_code", readString(row, "inviteCode")),
  };
}

function toMember(row: RowRecord): TeamMember {
  const name =
    readOptionalString(row, "display_name") ??
    readOptionalString(row, "email") ??
    "Unnamed member";

  return {
    id: readString(row, "id"),
    teamId: readString(row, "workspace_id", readString(row, "team_id")),
    userId: readOptionalString(row, "user_id"),
    name,
    email: readOptionalString(row, "email"),
    role: normalizeRole(row.app_role ?? row.role),
    status: normalizeMemberStatus(row.status),
    joinedAt: readOptionalString(row, "joined_at"),
    createdAt: readOptionalString(row, "created_at"),
    updatedAt: readOptionalString(row, "updated_at"),
  };
}

function toTarget(row: RowRecord): WorkTarget {
  return {
    id: readString(row, "id"),
    teamId: readString(row, "workspace_id", readString(row, "team_id")),
    title: readString(row, "title", "Untitled target"),
    description: readString(row, "description"),
    status: normalizeTargetStatus(row),
    priority: normalizePriority(row.priority),
    createdById: readOptionalString(row, "created_by_member_id"),
    claimedById: readOptionalString(row, "claimed_by_member_id"),
    claimedAt: readOptionalString(row, "claimed_at"),
    blockedReason: readOptionalString(row, "blocked_reason"),
    blockedAt: readOptionalString(row, "blocked_at"),
    completedById: readOptionalString(row, "completed_by_member_id"),
    completedAt: readOptionalString(row, "completed_at"),
    dueDate: readOptionalString(row, "due_date"),
    archivedAt: readOptionalString(row, "archived_at"),
    createdAt: readOptionalString(row, "created_at"),
    updatedAt: readOptionalString(row, "updated_at"),
  };
}

function toActivity(row: RowRecord): TargetActivity {
  return {
    id: readString(row, "id"),
    targetId: readString(row, "target_id"),
    teamId: readString(row, "workspace_id", readString(row, "team_id")),
    actorId: readOptionalString(row, "actor_member_id"),
    action: normalizeAction(row.action),
    oldStatus: normalizeTargetStatus({ status: row.old_status }),
    newStatus: normalizeTargetStatus({ status: row.new_status }),
    note: readOptionalString(row, "note"),
    metadata: normalizeMetadata(row.metadata),
    createdAt: readString(row, "created_at", new Date().toISOString()),
  };
}

function toNote(row: RowRecord): TargetNote {
  return {
    id: readString(row, "id"),
    targetId: readString(row, "target_id"),
    teamId: readString(row, "workspace_id", readString(row, "team_id")),
    userId: readOptionalString(row, "member_id"),
    body: readString(row, "body"),
    createdAt: readString(row, "created_at", new Date().toISOString()),
    updatedAt: readOptionalString(row, "updated_at"),
  };
}

function migrationHint(message: string) {
  const lower = message.toLowerCase();
  const looksLikeSchemaGap =
    lower.includes("does not exist") ||
    lower.includes("could not find") ||
    lower.includes("column") ||
    lower.includes("function") ||
    lower.includes("relation");

  if (!looksLikeSchemaGap) return message;

  return `${message} Apply supabase/migrations/20260521_work_ownership_tracker.sql to this Supabase project.`;
}

function throwSupabaseError(error: { message?: string } | null) {
  if (!error) return;
  throw new Error(migrationHint(error.message ?? "Supabase request failed."));
}

export function getClientForRealtime() {
  return getSupabaseClient();
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  throwSupabaseError(error);
  return data.user ?? null;
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  throwSupabaseError(error);
  return data.user ?? null;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string
) {
  const supabase = requireSupabaseClient();
  const redirectTo =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/login?authVerified=true`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        display_name: displayName || email,
      },
    },
  });

  throwSupabaseError(error);
  return data.user ?? null;
}

export async function sendPasswordReset(email: string) {
  const supabase = requireSupabaseClient();
  const redirectTo =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/login`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  throwSupabaseError(error);
}

export async function signOut() {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.signOut();
  throwSupabaseError(error);
}

export async function listTeams(): Promise<Team[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("get_accessible_workspaces");
  throwSupabaseError(error);
  return rows(data).map(toTeam).filter((team) => Boolean(team.id));
}

export async function createTeam(name: string): Promise<Team> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("create_team", {
    team_name: name.trim(),
  });
  throwSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRowRecord(row)) throw new Error("Team creation returned no team.");
  return toTeam(row);
}

export async function joinTeamByInviteCode(inviteCode: string): Promise<Team> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("join_team_by_invite_code", {
    invite_code_input: inviteCode.trim(),
  });
  throwSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRowRecord(row)) throw new Error("Join team returned no team.");
  return toTeam(row);
}

export async function inviteMemberByEmail(input: TeamInviteInput): Promise<TeamMember> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("add_workspace_member_by_email", {
    target_workspace_id: input.teamId,
    teammate_email: input.email.trim().toLowerCase(),
    member_role: input.role,
  });
  throwSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRowRecord(row)) throw new Error("Invite returned no member.");
  return toMember(row);
}

export async function loadBoardData(teamId: string): Promise<BoardData> {
  const supabase = requireSupabaseClient();

  const [memberResult, targetResult, activityResult, noteResult] = await Promise.all([
    supabase
      .from("workspace_members")
      .select(
        "id,workspace_id,user_id,email,display_name,role,app_role,status,joined_at,created_at,updated_at"
      )
      .eq("workspace_id", teamId)
      .neq("status", "removed")
      .order("created_at", { ascending: true }),
    supabase
      .from("targets")
      .select(
        "id,workspace_id,title,description,status,priority,created_by_member_id,claimed_by_member_id,claimed_at,blocked_reason,blocked_at,completed_by_member_id,completed_at,due_date,archived_at,created_at,updated_at,is_archived"
      )
      .eq("workspace_id", teamId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("target_activity")
      .select(
        "id,workspace_id,target_id,actor_member_id,action,old_status,new_status,note,metadata,created_at"
      )
      .eq("workspace_id", teamId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("target_notes")
      .select("id,workspace_id,target_id,member_id,body,created_at,updated_at")
      .eq("workspace_id", teamId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  throwSupabaseError(memberResult.error);
  throwSupabaseError(targetResult.error);
  throwSupabaseError(activityResult.error);
  throwSupabaseError(noteResult.error);

  return {
    members: rows(memberResult.data).map(toMember),
    targets: rows(targetResult.data).map(toTarget),
    activities: rows(activityResult.data).map(toActivity),
    notes: rows(noteResult.data).map(toNote),
  };
}

async function runTargetRpc(name: string, args: RpcArgs): Promise<WorkTarget> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  throwSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRowRecord(row)) throw new Error(`${name} returned no target.`);
  return toTarget(row);
}

export async function createTarget(input: CreateTargetInput) {
  return runTargetRpc("create_target", {
    team_id: input.teamId,
    target_title: input.title.trim(),
    target_description: input.description?.trim() ?? "",
    target_priority: input.priority,
    target_due_date: input.dueDate || null,
  });
}

export async function claimTarget(targetId: string) {
  return runTargetRpc("claim_target", { target_id: targetId });
}

export async function releaseTarget(targetId: string, reason: string) {
  return runTargetRpc("release_target", {
    target_id: targetId,
    release_reason: reason.trim() || null,
  });
}

export async function forceReleaseTarget(targetId: string, reason: string) {
  return runTargetRpc("force_release_target", {
    target_id: targetId,
    release_reason: reason.trim(),
  });
}

export async function blockTarget(targetId: string, reason: string) {
  return runTargetRpc("block_target", {
    target_id: targetId,
    block_reason: reason.trim(),
  });
}

export async function completeTarget(targetId: string) {
  return runTargetRpc("complete_target", { target_id: targetId });
}

export async function reopenTarget(targetId: string) {
  return runTargetRpc("reopen_target", { target_id: targetId });
}

export async function archiveTarget(targetId: string) {
  return runTargetRpc("archive_target", { target_id: targetId });
}

export async function addTargetNote(targetId: string, body: string): Promise<TargetNote> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc("add_target_note", {
    target_id: targetId,
    note_body: body.trim(),
  });
  throwSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRowRecord(row)) throw new Error("add_target_note returned no note.");
  return toNote(row);
}
