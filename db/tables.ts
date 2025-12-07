/**
 * Pet Care Planner - organize pet info, routines, and health logs.
 *
 * Design goals:
 * - Pets table (multiple pets per user).
 * - Care routines (recurring tasks like feeding, walking, grooming).
 * - Logs for tasks and vet visits.
 */

import { defineTable, column, NOW } from "astro:db";

export const Pets = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    name: column.text(),                            // "Bruno", "Mithra (cat)", etc.
    species: column.text({ optional: true }),       // "dog", "cat", "bird", etc.
    breed: column.text({ optional: true }),
    gender: column.text({ optional: true }),        // "male", "female", etc.
    dateOfBirth: column.date({ optional: true }),
    color: column.text({ optional: true }),

    weightKg: column.number({ optional: true }),
    notes: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const PetCareRoutines = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    petId: column.text({
      references: () => Pets.columns.id,
    }),
    userId: column.text(),

    name: column.text(),                            // "Morning feeding", "Evening walk"
    description: column.text({ optional: true }),
    frequency: column.text({ optional: true }),     // "daily", "weekly", "monthly"
    timeOfDayLocal: column.text({ optional: true }),// "07:30", "20:00"
    daysOfWeekJson: column.text({ optional: true }),// JSON: ["mon","wed","fri"]

    isActive: column.boolean({ default: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const PetCareLogs = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    petId: column.text({
      references: () => Pets.columns.id,
    }),
    routineId: column.text({
      references: () => PetCareRoutines.columns.id,
      optional: true,
    }),
    userId: column.text(),

    logDateTime: column.date({ default: NOW }),
    status: column.text({ optional: true }),        // "done", "skipped"
    notes: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const VetVisits = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    petId: column.text({
      references: () => Pets.columns.id,
    }),
    userId: column.text(),

    visitDate: column.date({ default: NOW }),
    clinicName: column.text({ optional: true }),
    reason: column.text({ optional: true }),        // "vaccination", "check-up"
    diagnosis: column.text({ optional: true }),
    treatment: column.text({ optional: true }),
    medications: column.text({ optional: true }),
    followUpDate: column.date({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  Pets,
  PetCareRoutines,
  PetCareLogs,
  VetVisits,
} as const;
