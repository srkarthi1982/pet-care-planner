import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
  and,
  db,
  eq,
  PetCareLogs,
  PetCareRoutines,
  Pets,
  VetVisits,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

function parseDateInput(value?: Date | string | null) {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

async function assertPetOwnership(petId: string, userId: string) {
  const pet = await db
    .select()
    .from(Pets)
    .where(and(eq(Pets.id, petId), eq(Pets.userId, userId)));

  if (!pet.length) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Pet not found.",
    });
  }

  return pet[0];
}

async function assertRoutineOwnership(routineId: string, userId: string) {
  const routine = await db
    .select()
    .from(PetCareRoutines)
    .where(and(eq(PetCareRoutines.id, routineId), eq(PetCareRoutines.userId, userId)));

  if (!routine.length) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Care routine not found.",
    });
  }

  return routine[0];
}

export const server = {
  createPet: defineAction({
    input: z.object({
      name: z.string().min(1),
      species: z.string().optional(),
      breed: z.string().optional(),
      gender: z.string().optional(),
      dateOfBirth: z.union([z.date(), z.string().datetime()]).optional(),
      color: z.string().optional(),
      weightKg: z.number().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const pet = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: input.name,
        species: input.species,
        breed: input.breed,
        gender: input.gender,
        dateOfBirth: parseDateInput(input.dateOfBirth),
        color: input.color,
        weightKg: input.weightKg,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof Pets.$inferInsert;

      await db.insert(Pets).values(pet);

      return { success: true, data: { pet } };
    },
  }),

  updatePet: defineAction({
    input: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      species: z.string().optional(),
      breed: z.string().optional(),
      gender: z.string().optional(),
      dateOfBirth: z.union([z.date(), z.string().datetime()]).optional(),
      color: z.string().optional(),
      weightKg: z.number().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.id, user.id);

      const updates: Partial<typeof Pets.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updates.name = input.name;
      if (input.species !== undefined) updates.species = input.species;
      if (input.breed !== undefined) updates.breed = input.breed;
      if (input.gender !== undefined) updates.gender = input.gender;
      if (input.color !== undefined) updates.color = input.color;
      if (input.weightKg !== undefined) updates.weightKg = input.weightKg;
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.dateOfBirth !== undefined)
        updates.dateOfBirth = parseDateInput(input.dateOfBirth);

      await db
        .update(Pets)
        .set(updates)
        .where(and(eq(Pets.id, input.id), eq(Pets.userId, user.id)));

      return { success: true };
    },
  }),

  deletePet: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.id, user.id);

      await db
        .delete(Pets)
        .where(and(eq(Pets.id, input.id), eq(Pets.userId, user.id)));

      return { success: true };
    },
  }),

  listPets: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);
      const pets = await db.select().from(Pets).where(eq(Pets.userId, user.id));

      return { success: true, data: { items: pets, total: pets.length } };
    },
  }),

  createPetCareRoutine: defineAction({
    input: z.object({
      petId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      frequency: z.string().optional(),
      timeOfDayLocal: z.string().optional(),
      daysOfWeek: z.array(z.string()).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.petId, user.id);
      const now = new Date();

      const routine = {
        id: crypto.randomUUID(),
        petId: input.petId,
        userId: user.id,
        name: input.name,
        description: input.description,
        frequency: input.frequency,
        timeOfDayLocal: input.timeOfDayLocal,
        daysOfWeekJson: input.daysOfWeek
          ? JSON.stringify(input.daysOfWeek)
          : undefined,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof PetCareRoutines.$inferInsert;

      await db.insert(PetCareRoutines).values(routine);

      return { success: true, data: { routine } };
    },
  }),

  updatePetCareRoutine: defineAction({
    input: z.object({
      id: z.string().min(1),
      petId: z.string().optional(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      frequency: z.string().optional(),
      timeOfDayLocal: z.string().optional(),
      daysOfWeek: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const routine = await assertRoutineOwnership(input.id, user.id);

      const targetPetId = input.petId ?? routine.petId;
      await assertPetOwnership(targetPetId, user.id);

      const updates: Partial<typeof PetCareRoutines.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.petId !== undefined) updates.petId = input.petId;
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.frequency !== undefined) updates.frequency = input.frequency;
      if (input.timeOfDayLocal !== undefined)
        updates.timeOfDayLocal = input.timeOfDayLocal;
      if (input.daysOfWeek !== undefined)
        updates.daysOfWeekJson = JSON.stringify(input.daysOfWeek);
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await db
        .update(PetCareRoutines)
        .set(updates)
        .where(and(eq(PetCareRoutines.id, input.id), eq(PetCareRoutines.userId, user.id)));

      return { success: true };
    },
  }),

  archivePetCareRoutine: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertRoutineOwnership(input.id, user.id);

      await db
        .update(PetCareRoutines)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(PetCareRoutines.id, input.id), eq(PetCareRoutines.userId, user.id)));

      return { success: true };
    },
  }),

  listPetCareRoutines: defineAction({
    input: z
      .object({
        petId: z.string().optional(),
        includeInactive: z.boolean().default(false),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const filters = [eq(PetCareRoutines.userId, user.id)];

      if (input?.petId) filters.push(eq(PetCareRoutines.petId, input.petId));
      if (!input?.includeInactive)
        filters.push(eq(PetCareRoutines.isActive, true));

      const whereClause = filters.length === 1 ? filters[0] : and(...filters);
      const routines = await db
        .select()
        .from(PetCareRoutines)
        .where(whereClause);

      return { success: true, data: { items: routines, total: routines.length } };
    },
  }),

  createPetCareLog: defineAction({
    input: z.object({
      petId: z.string().min(1),
      routineId: z.string().optional(),
      logDateTime: z.union([z.date(), z.string().datetime()]).optional(),
      status: z.enum(["done", "skipped"]).optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.petId, user.id);

      if (input.routineId) {
        const routine = await assertRoutineOwnership(input.routineId, user.id);
        if (routine.petId !== input.petId) {
          throw new ActionError({
            code: "FORBIDDEN",
            message: "Routine does not belong to this pet.",
          });
        }
      }

      const log = {
        id: crypto.randomUUID(),
        petId: input.petId,
        routineId: input.routineId,
        userId: user.id,
        logDateTime: input.logDateTime
          ? parseDateInput(input.logDateTime)
          : new Date(),
        status: input.status,
        notes: input.notes,
        createdAt: new Date(),
      } satisfies typeof PetCareLogs.$inferInsert;

      await db.insert(PetCareLogs).values(log);

      return { success: true, data: { log } };
    },
  }),

  listPetCareLogs: defineAction({
    input: z.object({ petId: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.petId, user.id);

      const logs = await db
        .select()
        .from(PetCareLogs)
        .where(and(eq(PetCareLogs.petId, input.petId), eq(PetCareLogs.userId, user.id)));

      return { success: true, data: { items: logs, total: logs.length } };
    },
  }),

  deletePetCareLog: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const log = await db
        .select()
        .from(PetCareLogs)
        .where(and(eq(PetCareLogs.id, input.id), eq(PetCareLogs.userId, user.id)));

      if (!log.length) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Care log not found.",
        });
      }

      await db
        .delete(PetCareLogs)
        .where(and(eq(PetCareLogs.id, input.id), eq(PetCareLogs.userId, user.id)));

      return { success: true };
    },
  }),

  createVetVisit: defineAction({
    input: z.object({
      petId: z.string().min(1),
      visitDate: z.union([z.date(), z.string().datetime()]).optional(),
      clinicName: z.string().optional(),
      reason: z.string().optional(),
      diagnosis: z.string().optional(),
      treatment: z.string().optional(),
      medications: z.string().optional(),
      followUpDate: z.union([z.date(), z.string().datetime()]).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.petId, user.id);

      const visit = {
        id: crypto.randomUUID(),
        petId: input.petId,
        userId: user.id,
        visitDate: input.visitDate ? parseDateInput(input.visitDate) : new Date(),
        clinicName: input.clinicName,
        reason: input.reason,
        diagnosis: input.diagnosis,
        treatment: input.treatment,
        medications: input.medications,
        followUpDate: parseDateInput(input.followUpDate),
        createdAt: new Date(),
      } satisfies typeof VetVisits.$inferInsert;

      await db.insert(VetVisits).values(visit);

      return { success: true, data: { visit } };
    },
  }),

  updateVetVisit: defineAction({
    input: z.object({
      id: z.string().min(1),
      petId: z.string().optional(),
      visitDate: z.union([z.date(), z.string().datetime()]).optional(),
      clinicName: z.string().optional(),
      reason: z.string().optional(),
      diagnosis: z.string().optional(),
      treatment: z.string().optional(),
      medications: z.string().optional(),
      followUpDate: z.union([z.date(), z.string().datetime()]).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const visit = await db
        .select()
        .from(VetVisits)
        .where(and(eq(VetVisits.id, input.id), eq(VetVisits.userId, user.id)));

      if (!visit.length) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Vet visit not found.",
        });
      }

      const targetPetId = input.petId ?? visit[0].petId;
      await assertPetOwnership(targetPetId, user.id);

      const updates: Partial<typeof VetVisits.$inferInsert> = {};

      if (input.petId !== undefined) updates.petId = input.petId;
      if (input.visitDate !== undefined)
        updates.visitDate = parseDateInput(input.visitDate);
      if (input.clinicName !== undefined) updates.clinicName = input.clinicName;
      if (input.reason !== undefined) updates.reason = input.reason;
      if (input.diagnosis !== undefined) updates.diagnosis = input.diagnosis;
      if (input.treatment !== undefined) updates.treatment = input.treatment;
      if (input.medications !== undefined) updates.medications = input.medications;
      if (input.followUpDate !== undefined)
        updates.followUpDate = parseDateInput(input.followUpDate);

      await db
        .update(VetVisits)
        .set(updates)
        .where(and(eq(VetVisits.id, input.id), eq(VetVisits.userId, user.id)));

      return { success: true };
    },
  }),

  deleteVetVisit: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const visit = await db
        .select()
        .from(VetVisits)
        .where(and(eq(VetVisits.id, input.id), eq(VetVisits.userId, user.id)));

      if (!visit.length) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Vet visit not found.",
        });
      }

      await db
        .delete(VetVisits)
        .where(and(eq(VetVisits.id, input.id), eq(VetVisits.userId, user.id)));

      return { success: true };
    },
  }),

  listVetVisits: defineAction({
    input: z.object({ petId: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await assertPetOwnership(input.petId, user.id);

      const visits = await db
        .select()
        .from(VetVisits)
        .where(and(eq(VetVisits.petId, input.petId), eq(VetVisits.userId, user.id)));

      return { success: true, data: { items: visits, total: visits.length } };
    },
  }),
};
