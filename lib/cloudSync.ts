import type { SupabaseClient, User } from "@supabase/supabase-js";

export type CloudFrequency = "once" | "daily" | "weekly" | "monthly";
export type CloudPriority = "low" | "medium" | "high" | "urgent";

export type CloudMember = {
  id: string;
  name: string;
  role: string;
};

export type CloudTarget = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: CloudPriority;
  ownerId: string;
  frequency: CloudFrequency;
  targetAmount: number;
  unit: string;
  startDate: string;
  isArchived: boolean;
};

export type CloudProgressLog = {
  id: string;
  targetId: string;
  date: string;
  achievedAmount: number;
  createdAt: string;
};

export type CloudSyncPayload = {
  members: CloudMember[];
  targets: CloudTarget[];
  logs: CloudProgressLog[];
  screenSettings: Record<string, boolean>;
};

type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
};

function normalizePriority(value: unknown): CloudPriority {
  if (value === "low" || value === "medium" || value === "high" || value === "urgent") {
    return value;
  }

  return "medium";
}

function normalizeFrequency(value: unknown): CloudFrequency {
  if (value === "once" || value === "daily" || value === "weekly" || value === "monthly") {
    return value;
  }

  return "daily";
}

export async function ensureUserWorkspace(
  supabase: SupabaseClient,
  user: User
): Promise<WorkspaceRow> {
  const { data: existingWorkspace, error: fetchError } = await supabase
    .from("workspaces")
    .select("id,name,owner_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existingWorkspace) {
    return existingWorkspace as WorkspaceRow;
  }

  const displayName =
    typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name
      ? user.user_metadata.display_name
      : user.email ?? "Me";

  const { data: createdWorkspace, error: createError } = await supabase
    .from("workspaces")
    .insert({
      owner_id: user.id,
      name: "My Workspace",
    })
    .select("id,name,owner_id")
    .single();

  if (createError) throw createError;

  const workspace = createdWorkspace as WorkspaceRow;

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    display_name: displayName,
    role: "Owner",
    app_role: "owner",
  });

  if (memberError) throw memberError;

  return workspace;
}

export async function saveLocalDataToCloud(
  supabase: SupabaseClient,
  user: User,
  payload: CloudSyncPayload
) {
  const workspace = await ensureUserWorkspace(supabase, user);

  const safeMembers =
    payload.members.length > 0
      ? payload.members
      : [{ id: "me", name: user.email ?? "Me", role: "Owner" }];

  await supabase.from("progress_logs").delete().eq("workspace_id", workspace.id);
  await supabase.from("targets").delete().eq("workspace_id", workspace.id);
  await supabase.from("workspace_members").delete().eq("workspace_id", workspace.id);

  const memberRows = safeMembers.map((member, index) => ({
    workspace_id: workspace.id,
    user_id: index === 0 ? user.id : null,
    display_name: member.name || "Unnamed member",
    role: member.role || (index === 0 ? "Owner" : "Member"),
    app_role: index === 0 ? "owner" : "member",
  }));

  const { data: insertedMembers, error: membersError } = await supabase
    .from("workspace_members")
    .insert(memberRows)
    .select("id,display_name,role");

  if (membersError) throw membersError;

  const memberIdMap = new Map<string, string>();

  safeMembers.forEach((member, index) => {
    const inserted = insertedMembers?.[index];
    if (inserted?.id) {
      memberIdMap.set(member.id, inserted.id);
    }
  });

  const fallbackMemberId = insertedMembers?.[0]?.id ?? null;

  const targetRows = payload.targets.map((target) => ({
    workspace_id: workspace.id,
    owner_member_id: memberIdMap.get(target.ownerId) ?? fallbackMemberId,
    title: target.title || "Untitled target",
    description: target.description || "",
    category: target.category || "General",
    priority: normalizePriority(target.priority),
    frequency: normalizeFrequency(target.frequency),
    target_amount: target.targetAmount || 1,
    unit: target.unit || "tasks",
    start_date: target.startDate,
    is_archived: Boolean(target.isArchived),
  }));

  const { data: insertedTargets, error: targetsError } = targetRows.length
    ? await supabase.from("targets").insert(targetRows).select("id")
    : { data: [], error: null };

  if (targetsError) throw targetsError;

  const targetIdMap = new Map<string, string>();

  payload.targets.forEach((target, index) => {
    const inserted = insertedTargets?.[index];
    if (inserted?.id) {
      targetIdMap.set(target.id, inserted.id);
    }
  });

  const logRows = payload.logs
    .filter((log) => targetIdMap.has(log.targetId))
    .map((log) => ({
      workspace_id: workspace.id,
      target_id: targetIdMap.get(log.targetId),
      progress_date: log.date,
      achieved_amount: log.achievedAmount || 1,
      created_at: log.createdAt,
    }));

  if (logRows.length > 0) {
    const { error: logsError } = await supabase.from("progress_logs").insert(logRows);
    if (logsError) throw logsError;
  }

  const { error: preferencesError } = await supabase
    .from("screen_preferences")
    .upsert(
      {
        user_id: user.id,
        workspace_id: workspace.id,
        settings: payload.screenSettings,
      },
      { onConflict: "user_id,workspace_id" }
    );

  if (preferencesError) throw preferencesError;

  return {
    workspace,
    memberCount: safeMembers.length,
    targetCount: payload.targets.length,
    logCount: payload.logs.length,
  };
}

export async function loadCloudDataFromCloud(
  supabase: SupabaseClient,
  user: User
) {
  const workspace = await ensureUserWorkspace(supabase, user);

  const { data: memberRows, error: membersError } = await supabase
    .from("workspace_members")
    .select("id,display_name,role")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (membersError) throw membersError;

  const members: CloudMember[] =
    memberRows?.map((member) => ({
      id: member.id,
      name: member.display_name || "Unnamed member",
      role: member.role || "Member",
    })) ?? [];

  const fallbackMemberId = members[0]?.id ?? "me";

  const { data: targetRows, error: targetsError } = await supabase
    .from("targets")
    .select("id,owner_member_id,title,description,category,priority,frequency,target_amount,unit,start_date,is_archived")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (targetsError) throw targetsError;

  const targets: CloudTarget[] =
    targetRows?.map((target) => ({
      id: target.id,
      title: target.title || "Untitled target",
      description: target.description || "",
      category: target.category || "General",
      priority: normalizePriority(target.priority),
      ownerId: target.owner_member_id ?? fallbackMemberId,
      frequency: normalizeFrequency(target.frequency),
      targetAmount: Number(target.target_amount) || 1,
      unit: target.unit || "tasks",
      startDate: target.start_date,
      isArchived: Boolean(target.is_archived),
    })) ?? [];

  const { data: logRows, error: logsError } = await supabase
    .from("progress_logs")
    .select("id,target_id,progress_date,achieved_amount,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (logsError) throw logsError;

  const logs: CloudProgressLog[] =
    logRows?.map((log) => ({
      id: log.id,
      targetId: log.target_id,
      date: log.progress_date,
      achievedAmount: Number(log.achieved_amount) || 1,
      createdAt: log.created_at,
    })) ?? [];

  const { data: preferences, error: preferencesError } = await supabase
    .from("screen_preferences")
    .select("settings")
    .eq("user_id", user.id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (preferencesError) throw preferencesError;

  return {
    workspace,
    members,
    targets,
    logs,
    screenSettings: preferences?.settings ?? null,
  };
}
