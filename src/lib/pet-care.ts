import {
  and,
  asc,
  db,
  desc,
  eq,
  gte,
  PetCareLogs,
  PetCareRoutines,
  Pets,
  VetVisits,
} from "astro:db";

export type PetSummary = {
  totalPets: number;
  activePets: number;
  archivedPets: number;
  routinesCount: number;
  recentLogsCount: number;
  totalActiveRoutines: number;
  mostRecentPetName: string | null;
};

export async function listPetsForUser(userId: string) {
  return db
    .select()
    .from(Pets)
    .where(eq(Pets.userId, userId))
    .orderBy(desc(Pets.updatedAt));
}

export async function getPetDetailForUser(userId: string, petId: string) {
  const petRows = await db
    .select()
    .from(Pets)
    .where(and(eq(Pets.id, petId), eq(Pets.userId, userId)));

  if (!petRows.length) {
    return null;
  }

  const [routines, logs, vetVisits] = await Promise.all([
    db
      .select()
      .from(PetCareRoutines)
      .where(eq(PetCareRoutines.petId, petId))
      .orderBy(asc(PetCareRoutines.sortOrder), asc(PetCareRoutines.title)),
    db
      .select()
      .from(PetCareLogs)
      .where(eq(PetCareLogs.petId, petId))
      .orderBy(desc(PetCareLogs.loggedAt))
      .limit(20),
    db
      .select()
      .from(VetVisits)
      .where(eq(VetVisits.petId, petId))
      .orderBy(desc(VetVisits.visitDate)),
  ]);

  const now = new Date();
  const upcomingFollowUpsCount = vetVisits.filter(
    (visit) => visit.followUpDate && visit.followUpDate >= now,
  ).length;

  return {
    pet: petRows[0],
    routines,
    logs,
    vetVisits,
    stats: {
      totalActiveRoutines: routines.filter((routine) => routine.isActive).length,
      recentLogCount: logs.length,
      upcomingFollowUpsCount,
    },
  };
}

export async function getPetSummaryForUser(userId: string): Promise<PetSummary> {
  const [pets, routines, recentLogs] = await Promise.all([
    listPetsForUser(userId),
    db
      .select()
      .from(PetCareRoutines)
      .where(eq(PetCareRoutines.userId, userId)),
    db
      .select()
      .from(PetCareLogs)
      .where(
        and(
          eq(PetCareLogs.userId, userId),
          gte(PetCareLogs.loggedAt, new Date(Date.now() - 1000 * 60 * 60 * 24 * 14)),
        ),
      ),
  ]);

  const activePets = pets.filter((pet) => pet.status === "active").length;
  const archivedPets = pets.filter((pet) => pet.status === "archived").length;
  const mostRecentPetName = pets[0]?.name ?? null;
  const totalActiveRoutines = routines.filter((routine) => routine.isActive).length;

  return {
    totalPets: pets.length,
    activePets,
    archivedPets,
    routinesCount: routines.length,
    recentLogsCount: recentLogs.length,
    totalActiveRoutines,
    mostRecentPetName,
  };
}

export async function pushDashboardSummary(params: {
  userId: string;
  sessionToken?: string | null;
  rootAppUrl?: string;
}) {
  const webhook =
    import.meta.env.ANSIVERSA_DASHBOARD_WEBHOOK_URL ??
    (params.rootAppUrl ? `${params.rootAppUrl}/api/dashboard/mini-app-summary` : undefined);

  if (!webhook) return;

  const summary = await getPetSummaryForUser(params.userId);

  await fetch(webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(params.sessionToken ? { authorization: `Bearer ${params.sessionToken}` } : {}),
    },
    body: JSON.stringify({
      appId: "pet-care-planner",
      userId: params.userId,
      summary: {
        totalPets: summary.totalPets,
        activePets: summary.activePets,
        totalActiveRoutines: summary.totalActiveRoutines,
        mostRecentPetName: summary.mostRecentPetName,
      },
      updatedAt: new Date().toISOString(),
    }),
  }).catch(() => undefined);
}

export async function pushNotification(params: {
  userId: string;
  sessionToken?: string | null;
  rootAppUrl?: string;
  title: string;
  message: string;
  level?: "info" | "success";
}) {
  const webhook =
    import.meta.env.ANSIVERSA_NOTIFICATIONS_WEBHOOK_URL ??
    (params.rootAppUrl ? `${params.rootAppUrl}/api/notifications/events` : undefined);

  if (!webhook) return;

  await fetch(webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(params.sessionToken ? { authorization: `Bearer ${params.sessionToken}` } : {}),
    },
    body: JSON.stringify({
      appId: "pet-care-planner",
      userId: params.userId,
      title: params.title,
      message: params.message,
      level: params.level ?? "info",
      createdAt: new Date().toISOString(),
    }),
  }).catch(() => undefined);
}
