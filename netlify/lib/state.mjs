import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const TZ = process.env.TZ_NAME || "Europe/Istanbul";

// "2026-09-19" biçiminde bugünün tarihi (Türkiye saatiyle)
export const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

const store = () => getStore("vergi-defteri");

const defaults = () => ({
  settings: { guildName: "Lonca Adı", subtitle: "Vergi Defteri" },
  period: { start: today(), weeklyTax: "" },
  members: [],
});

export async function loadState() {
  const saved = await store().get("state", { type: "json" });
  return saved ? { ...defaults(), ...saved } : defaults();
}

export async function saveState(state) {
  await store().setJSON("state", state);
}

// Sitede görünecek hâli: Discord ID'leri ve iç alanlar dışarı verilmez.
export function publicState(state) {
  return {
    settings: state.settings,
    period: state.period,
    members: state.members.map(({ discordId, prevLastPaid, ...m }) => m),
  };
}

export const clean = (v, max = 60) =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const newId = () => crypto.randomUUID();

export function markPaid(m) {
  if (m.status !== "paid") {
    m.prevLastPaid = m.lastPaid || "";
    m.lastPaid = today();
  }
  m.status = "paid";
}

export function markUnpaid(m) {
  if (m.status === "paid") m.lastPaid = m.prevLastPaid || "";
  m.status = "unpaid";
}
