import { NOW, column, defineTable } from "astro:db";

export const Pets = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    name: column.text(),
    species: column.text({ optional: true, deprecated: true }),
    gender: column.text({ optional: true, deprecated: true }),
    dateOfBirth: column.date({ optional: true, deprecated: true }),
    color: column.text({ optional: true, deprecated: true }),
    weightKg: column.number({ optional: true, deprecated: true }),
    petType: column.text({ optional: true }),
    breed: column.text({ optional: true }),
    birthday: column.date({ optional: true }),
    ageLabel: column.text({ optional: true }),
    notes: column.text({ optional: true }),
    status: column.text({ default: "active" }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
    archivedAt: column.date({ optional: true }),
  },
  indexes: {
    petsUserIdx: { on: ["userId"] },
    petsUserStatusIdx: { on: ["userId", "status"] },
  },
});

export const PetCareRoutines = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    petId: column.text({ references: () => Pets.columns.id }),
    userId: column.text(),
    name: column.text({ optional: true, deprecated: true }),
    description: column.text({ optional: true, deprecated: true }),
    frequency: column.text({ optional: true, deprecated: true }),
    timeOfDayLocal: column.text({ optional: true, deprecated: true }),
    daysOfWeekJson: column.text({ optional: true, deprecated: true }),
    title: column.text({ optional: true }),
    routineType: column.text({ optional: true }),
    frequencyLabel: column.text({ optional: true }),
    timeOfDay: column.text({ optional: true }),
    notes: column.text({ optional: true }),
    isActive: column.boolean({ default: true }),
    sortOrder: column.number({ default: 0 }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: {
    routinesUserIdx: { on: ["userId"] },
    routinesPetIdx: { on: ["petId"] },
    routinesPetActiveIdx: { on: ["petId", "isActive"] },
  },
});

export const PetCareLogs = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    petId: column.text({ references: () => Pets.columns.id }),
    routineId: column.text({ references: () => PetCareRoutines.columns.id, optional: true }),
    userId: column.text(),
    logDateTime: column.date({ optional: true, deprecated: true }),
    status: column.text({ optional: true, deprecated: true }),
    title: column.text({ optional: true }),
    loggedAt: column.date({ default: NOW }),
    notes: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
  },
  indexes: {
    logsUserIdx: { on: ["userId"] },
    logsPetIdx: { on: ["petId"] },
    logsPetLoggedAtIdx: { on: ["petId", "loggedAt"] },
  },
});

export const VetVisits = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    petId: column.text({ references: () => Pets.columns.id }),
    userId: column.text(),
    visitDate: column.date(),
    clinicName: column.text({ optional: true }),
    reason: column.text({ optional: true }),
    diagnosis: column.text({ optional: true, deprecated: true }),
    treatment: column.text({ optional: true, deprecated: true }),
    medications: column.text({ optional: true, deprecated: true }),
    notes: column.text({ optional: true }),
    followUpDate: column.date({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: {
    vetVisitsUserIdx: { on: ["userId"] },
    vetVisitsPetIdx: { on: ["petId"] },
    vetVisitsFollowUpIdx: { on: ["petId", "followUpDate"] },
  },
});

export const tables = { Pets, PetCareRoutines, PetCareLogs, VetVisits };
