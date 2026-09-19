import { loadState, publicState } from "../lib/state.mjs";

export default async () => {
  const state = await loadState();
  return Response.json(publicState(state), {
    headers: { "cache-control": "no-store" },
  });
};

export const config = { path: "/api/state" };
