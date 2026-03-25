import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
  and,
  asc,
  db,
  desc,
  eq,
  PetCareLogs,
  PetCareRoutines,
  Pets,
  VetVisits,
} from "astro:db";
import {
  getPetDetailForUser,
  listPetsForUser,
  pushDashboardSummary,
  pushNotification,
} from "../lib/pet-care";

const petTypeEnum = z.enum(["dog", "cat", "bird", "fish", "rabbit", "other"]);
const routineTypeEnum = z.enum(["feeding", "walking", "grooming", "medicine", "play", "custom"]);

function requireUser(context: ActionAPIContext) {
  const user = (context.locals as App.Locals).user;
  if (!user) {
    throw new ActionError({ code: "UNAUTHORIZED", message: "Sign in required." });
  }
  return user;
}

function parseDate(value?: Date | string | null) {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

async function assertPetOwnership(petId: string, userId: string) {
  const rows = await db.select().from(Pets).where(and(eq(Pets.id, petId), eq(Pets.userId, userId)));
  if (!rows.length) {
    throw new ActionError({ code: "NOT_FOUND", message: "Pet not found." });
  }
  return rows[0];
}

async function assertRoutineOwnership(routineId: string, userId: string) {
  const rows = await db
    .select()
    .from(PetCareRoutines)
    .where(and(eq(PetCareRoutines.id, routineId), eq(PetCareRoutines.userId, userId)));
  if (!rows.length) {
    throw new ActionError({ code: "NOT_FOUND", message: "Routine not found." });
  }
  return rows[0];
}

async function assertVetVisitOwnership(visitId: string, userId: string) {
  const rows = await db
    .select()
    .from(VetVisits)
    .where(and(eq(VetVisits.id, visitId), eq(VetVisits.userId, userId)));
  if (!rows.length) {
    throw new ActionError({ code: "NOT_FOUND", message: "Vet visit not found." });
  }
  return rows[0];
}

export const server = {
  listPets: defineAction({
    handler: async (_, context) => {
      const user = requireUser(context);
      const pets = await listPetsForUser(user.id);
      return { success: true, data: { items: pets } };
    },
  }),

  getPetDetail: defineAction({
    input: z.object({ petId: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const detail = await getPetDetailForUser(user.id, input.petId);

      if (!detail) {
        throw new ActionError({ code: "NOT_FOUND", message: "Pet not found." });
      }

      return { success: true, data: detail };
    },
  }),

  createPet: defineAction({
    input: z.object({
      name: z.string().min(1).max(80),
      petType: petTypeEnum.optional(),
      breed: z.string().max(80).optional(),
      birthday: z.union([z.date(), z.string().date()]).optional(),
      ageLabel: z.string().max(40).optional(),
      notes: z.string().max(1000).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const pet = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: input.name.trim(),
        petType: input.petType,
        breed: input.breed?.trim() || undefined,
        birthday: parseDate(input.birthday),
        ageLabel: input.ageLabel?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        status: "active",
        createdAt: now,
        updatedAt: now,
      } satisfies typeof Pets.$inferInsert;

      await db.insert(Pets).values(pet);

      await Promise.all([
        pushDashboardSummary({ userId: user.id, sessionToken: context.locals.sessionToken, rootAppUrl: context.locals.rootAppUrl }),
        pushNotification({
          userId: user.id,
          sessionToken: context.locals.sessionToken,
          rootAppUrl: context.locals.rootAppUrl,
          title: "Pet added",
          message: `${pet.name} has been added to your care planner.`,
          level: "success",
        }),
      ]);

      return { success: true, data: { pet } };
    },
  }),

  updatePet: defineAction({
    input: z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(80),
      petType: petTypeEnum.nullable().optional(),
      breed: z.string().max(80).nullable().optional(),
      birthday: z.union([z.date(), z.string().date()]).nullable().optional(),
      ageLabel: z.string().max(40).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.id, user.id);

      const updates: Partial<typeof Pets.$inferInsert> = {
        name: input.name.trim(),
        updatedAt: new Date(),
      };
      if (input.petType !== undefined) updates.petType = input.petType || undefined;
      if (input.breed !== undefined) updates.breed = input.breed?.trim() || undefined;
      if (input.birthday !== undefined) updates.birthday = parseDate(input.birthday);
      if (input.ageLabel !== undefined) updates.ageLabel = input.ageLabel?.trim() || undefined;
      if (input.notes !== undefined) updates.notes = input.notes?.trim() || undefined;

      await db.update(Pets).set(updates).where(and(eq(Pets.id, input.id), eq(Pets.userId, user.id)));
      await pushDashboardSummary({ userId: user.id, sessionToken: context.locals.sessionToken, rootAppUrl: context.locals.rootAppUrl });

      return { success: true };
    },
  }),

  archivePet: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.id, user.id);

      await db
        .update(Pets)
        .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(Pets.id, input.id), eq(Pets.userId, user.id)));

      await pushDashboardSummary({ userId: user.id, sessionToken: context.locals.sessionToken, rootAppUrl: context.locals.rootAppUrl });
      return { success: true };
    },
  }),

  restorePet: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.id, user.id);

      await db
        .update(Pets)
        .set({ status: "active", archivedAt: undefined, updatedAt: new Date() })
        .where(and(eq(Pets.id, input.id), eq(Pets.userId, user.id)));

      await pushDashboardSummary({ userId: user.id, sessionToken: context.locals.sessionToken, rootAppUrl: context.locals.rootAppUrl });
      return { success: true };
    },
  }),

  createPetCareRoutine: defineAction({
    input: z.object({
      petId: z.string().min(1),
      title: z.string().min(1).max(120),
      routineType: routineTypeEnum.optional(),
      frequencyLabel: z.string().max(60).optional(),
      timeOfDay: z.string().max(40).optional(),
      notes: z.string().max(800).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.petId, user.id);

      const last = await db
        .select()
        .from(PetCareRoutines)
        .where(and(eq(PetCareRoutines.petId, input.petId), eq(PetCareRoutines.userId, user.id)))
        .orderBy(desc(PetCareRoutines.sortOrder))
        .limit(1);

      const routine = {
        id: crypto.randomUUID(),
        petId: input.petId,
        userId: user.id,
        title: input.title.trim(),
        routineType: input.routineType,
        frequencyLabel: input.frequencyLabel?.trim() || undefined,
        timeOfDay: input.timeOfDay?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        isActive: true,
        sortOrder: (last[0]?.sortOrder ?? -1) + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies typeof PetCareRoutines.$inferInsert;

      await db.insert(PetCareRoutines).values(routine);
      await pushDashboardSummary({ userId: user.id, sessionToken: context.locals.sessionToken, rootAppUrl: context.locals.rootAppUrl });

      return { success: true, data: { routine } };
    },
  }),

  updatePetCareRoutine: defineAction({
    input: z.object({
      id: z.string().min(1),
      title: z.string().min(1).max(120),
      routineType: routineTypeEnum.nullable().optional(),
      frequencyLabel: z.string().max(60).nullable().optional(),
      timeOfDay: z.string().max(40).nullable().optional(),
      notes: z.string().max(800).nullable().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertRoutineOwnership(input.id, user.id);

      await db
        .update(PetCareRoutines)
        .set({
          title: input.title.trim(),
          routineType: input.routineType || undefined,
          frequencyLabel: input.frequencyLabel?.trim() || undefined,
          timeOfDay: input.timeOfDay?.trim() || undefined,
          notes: input.notes?.trim() || undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(PetCareRoutines.id, input.id), eq(PetCareRoutines.userId, user.id)));

      return { success: true };
    },
  }),

  togglePetCareRoutineActive: defineAction({
    input: z.object({ id: z.string().min(1), isActive: z.boolean() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertRoutineOwnership(input.id, user.id);

      await db
        .update(PetCareRoutines)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(and(eq(PetCareRoutines.id, input.id), eq(PetCareRoutines.userId, user.id)));

      await pushDashboardSummary({ userId: user.id, sessionToken: context.locals.sessionToken, rootAppUrl: context.locals.rootAppUrl });
      return { success: true };
    },
  }),

  deletePetCareRoutine: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertRoutineOwnership(input.id, user.id);

      await db
        .delete(PetCareRoutines)
        .where(and(eq(PetCareRoutines.id, input.id), eq(PetCareRoutines.userId, user.id)));

      await pushDashboardSummary({ userId: user.id, sessionToken: context.locals.sessionToken, rootAppUrl: context.locals.rootAppUrl });
      return { success: true };
    },
  }),

  reorderPetCareRoutines: defineAction({
    input: z.object({ petId: z.string().min(1), orderedIds: z.array(z.string()).min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.petId, user.id);

      const routines = await db
        .select()
        .from(PetCareRoutines)
        .where(and(eq(PetCareRoutines.petId, input.petId), eq(PetCareRoutines.userId, user.id)))
        .orderBy(asc(PetCareRoutines.sortOrder));

      const existingIds = new Set(routines.map((routine) => routine.id));
      if (input.orderedIds.some((id) => !existingIds.has(id))) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Invalid routine order payload." });
      }

      await Promise.all(
        input.orderedIds.map((id, index) =>
          db
            .update(PetCareRoutines)
            .set({ sortOrder: index, updatedAt: new Date() })
            .where(and(eq(PetCareRoutines.id, id), eq(PetCareRoutines.userId, user.id))),
        ),
      );

      return { success: true };
    },
  }),

  createPetCareLog: defineAction({
    input: z.object({
      petId: z.string().min(1),
      routineId: z.string().optional(),
      title: z.string().min(1).max(120),
      loggedAt: z.union([z.date(), z.string().datetime()]).optional(),
      notes: z.string().max(800).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.petId, user.id);

      if (input.routineId) {
        const routine = await assertRoutineOwnership(input.routineId, user.id);
        if (routine.petId !== input.petId) {
          throw new ActionError({ code: "FORBIDDEN", message: "Routine belongs to another pet." });
        }
      }

      const log = {
        id: crypto.randomUUID(),
        petId: input.petId,
        routineId: input.routineId,
        userId: user.id,
        title: input.title.trim(),
        loggedAt: parseDate(input.loggedAt) ?? new Date(),
        notes: input.notes?.trim() || undefined,
        createdAt: new Date(),
      } satisfies typeof PetCareLogs.$inferInsert;

      await db.insert(PetCareLogs).values(log);
      return { success: true, data: { log } };
    },
  }),

  deletePetCareLog: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const logs = await db
        .select()
        .from(PetCareLogs)
        .where(and(eq(PetCareLogs.id, input.id), eq(PetCareLogs.userId, user.id)));

      if (!logs.length) {
        throw new ActionError({ code: "NOT_FOUND", message: "Care log not found." });
      }

      await db.delete(PetCareLogs).where(and(eq(PetCareLogs.id, input.id), eq(PetCareLogs.userId, user.id)));
      return { success: true };
    },
  }),

  createVetVisit: defineAction({
    input: z.object({
      petId: z.string().min(1),
      visitDate: z.union([z.date(), z.string().date()]),
      clinicName: z.string().max(120).optional(),
      reason: z.string().max(200).optional(),
      notes: z.string().max(1200).optional(),
      followUpDate: z.union([z.date(), z.string().date()]).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const pet = await assertPetOwnership(input.petId, user.id);
      const now = new Date();

      const visit = {
        id: crypto.randomUUID(),
        petId: input.petId,
        userId: user.id,
        visitDate: parseDate(input.visitDate) ?? now,
        clinicName: input.clinicName?.trim() || undefined,
        reason: input.reason?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        followUpDate: parseDate(input.followUpDate),
        createdAt: now,
        updatedAt: now,
      } satisfies typeof VetVisits.$inferInsert;

      await db.insert(VetVisits).values(visit);

      await Promise.all([
        pushNotification({
          userId: user.id,
          sessionToken: context.locals.sessionToken,
          rootAppUrl: context.locals.rootAppUrl,
          title: "Vet visit recorded",
          message: `${pet.name} visit logged for ${visit.visitDate.toISOString().slice(0, 10)}.`,
          level: "success",
        }),
        visit.followUpDate
          ? pushNotification({
              userId: user.id,
              sessionToken: context.locals.sessionToken,
              rootAppUrl: context.locals.rootAppUrl,
              title: "Follow-up added",
              message: `${pet.name} has a follow-up on ${visit.followUpDate.toISOString().slice(0, 10)}.`,
              level: "info",
            })
          : Promise.resolve(),
      ]);

      return { success: true, data: { visit } };
    },
  }),

  updateVetVisit: defineAction({
    input: z.object({
      id: z.string().min(1),
      visitDate: z.union([z.date(), z.string().date()]),
      clinicName: z.string().max(120).nullable().optional(),
      reason: z.string().max(200).nullable().optional(),
      notes: z.string().max(1200).nullable().optional(),
      followUpDate: z.union([z.date(), z.string().date()]).nullable().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertVetVisitOwnership(input.id, user.id);

      await db
        .update(VetVisits)
        .set({
          visitDate: parseDate(input.visitDate),
          clinicName: input.clinicName?.trim() || undefined,
          reason: input.reason?.trim() || undefined,
          notes: input.notes?.trim() || undefined,
          followUpDate: parseDate(input.followUpDate),
          updatedAt: new Date(),
        })
        .where(and(eq(VetVisits.id, input.id), eq(VetVisits.userId, user.id)));

      return { success: true };
    },
  }),

  deleteVetVisit: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertVetVisitOwnership(input.id, user.id);

      await db.delete(VetVisits).where(and(eq(VetVisits.id, input.id), eq(VetVisits.userId, user.id)));
      return { success: true };
    },
  }),
};
