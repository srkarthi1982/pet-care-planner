import type { Alpine } from "alpinejs";
import { createPetCareStore } from "./stores/petCareStore";

export default function initAlpine(Alpine: Alpine) {
  Alpine.store("petCare", createPetCareStore());
}
