import type { APIRoute } from "astro";
import { getPetSummaryForUser } from "../../lib/pet-care";

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const summary = await getPetSummaryForUser(user.id);

  return new Response(
    JSON.stringify({
      appId: "pet-care-planner",
      summary: {
        totalPets: summary.totalPets,
        activePets: summary.activePets,
        totalActiveRoutines: summary.totalActiveRoutines,
        mostRecentPetName: summary.mostRecentPetName,
      },
    }),
    { headers: { "content-type": "application/json" } },
  );
};
