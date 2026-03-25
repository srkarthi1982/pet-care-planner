import { actions } from "astro:actions";

type StoreState = {
  pets: any[];
  activePetDetail: any | null;
  activeTab: "overview" | "pets" | "archived";
  modals: Record<string, boolean>;
  loading: Record<string, boolean>;
  flash: { type: "success" | "error"; message: string } | null;
  init(payload: { pets?: any[]; activePetDetail?: any; activeTab?: StoreState["activeTab"] }): void;
  openModal(key: string): void;
  closeModal(key: string): void;
  setTab(tab: StoreState["activeTab"]): void;
  submitCreatePet(form: HTMLFormElement): Promise<void>;
  submitUpdatePet(form: HTMLFormElement): Promise<void>;
  archivePet(id: string): Promise<void>;
  restorePet(id: string): Promise<void>;
  submitRoutine(form: HTMLFormElement): Promise<void>;
  toggleRoutine(id: string, isActive: boolean): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  submitLog(form: HTMLFormElement): Promise<void>;
  submitVetVisit(form: HTMLFormElement): Promise<void>;
  deleteVetVisit(id: string): Promise<void>;
};

function formToObject(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

async function runAction<T>(promise: Promise<T>) {
  const result = await promise;
  return result;
}

export function createPetCareStore(): StoreState {
  return {
    pets: [],
    activePetDetail: null,
    activeTab: "overview",
    modals: {},
    loading: {},
    flash: null,

    init(payload) {
      this.pets = payload.pets ?? [];
      this.activePetDetail = payload.activePetDetail ?? null;
      this.activeTab = payload.activeTab ?? "overview";
    },

    openModal(key) {
      this.modals[key] = true;
      this.flash = null;
    },

    closeModal(key) {
      this.modals[key] = false;
    },

    setTab(tab) {
      this.activeTab = tab;
    },

    async submitCreatePet(form) {
      this.loading.createPet = true;
      try {
        await runAction(actions.createPet(formToObject(form) as any));
        this.flash = { type: "success", message: "Pet saved." };
        window.location.reload();
      } catch (error: any) {
        this.flash = { type: "error", message: error?.message ?? "Unable to save pet." };
      } finally {
        this.loading.createPet = false;
      }
    },

    async submitUpdatePet(form) {
      this.loading.updatePet = true;
      try {
        await runAction(actions.updatePet(formToObject(form) as any));
        this.flash = { type: "success", message: "Pet updated." };
        window.location.reload();
      } catch (error: any) {
        this.flash = { type: "error", message: error?.message ?? "Unable to update pet." };
      } finally {
        this.loading.updatePet = false;
      }
    },

    async archivePet(id) {
      await runAction(actions.archivePet({ id }));
      window.location.reload();
    },

    async restorePet(id) {
      await runAction(actions.restorePet({ id }));
      window.location.reload();
    },

    async submitRoutine(form) {
      const payload = formToObject(form) as any;
      const action = payload.id ? actions.updatePetCareRoutine : actions.createPetCareRoutine;
      await runAction(action(payload));
      window.location.reload();
    },

    async toggleRoutine(id, isActive) {
      await runAction(actions.togglePetCareRoutineActive({ id, isActive }));
      if (this.activePetDetail) {
        const routine = this.activePetDetail.routines.find((entry: any) => entry.id === id);
        if (routine) routine.isActive = isActive;
      }
    },

    async deleteRoutine(id) {
      await runAction(actions.deletePetCareRoutine({ id }));
      window.location.reload();
    },

    async submitLog(form) {
      await runAction(actions.createPetCareLog(formToObject(form) as any));
      window.location.reload();
    },

    async submitVetVisit(form) {
      const payload = formToObject(form) as any;
      const action = payload.id ? actions.updateVetVisit : actions.createVetVisit;
      await runAction(action(payload));
      window.location.reload();
    },

    async deleteVetVisit(id) {
      await runAction(actions.deleteVetVisit({ id }));
      window.location.reload();
    },
  };
}
