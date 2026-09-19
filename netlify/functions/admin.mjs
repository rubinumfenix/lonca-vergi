import crypto from "node:crypto";
import {
  loadState, saveState, publicState, clean, newId, today, markPaid, markUnpaid,
} from "../lib/state.mjs";

const SECRET = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
const sign = (payload) =>
  crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");

function makeToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000 })
  ).toString("base64url");
  return payload + "." + sign(payload);
}

function checkToken(token) {
  if (!token || !SECRET()) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function samePassword(input) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const h = (s) => crypto.createHash("sha256").update(String(s)).digest();
  return crypto.timingSafeEqual(h(input), h(pw));
}

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geçersiz istek" }, 400);
  }

  if (body.action === "login") {
    if (!samePassword(body.password ?? "")) {
      await new Promise((r) => setTimeout(r, 800)); // kaba kuvveti yavaşlat
      return json({ error: "Şifre yanlış" }, 401);
    }
    return json({ token: makeToken() });
  }

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!checkToken(bearer)) return json({ error: "Yetkisiz" }, 401);

  const state = await loadState();
  const find = (id) => state.members.find((m) => m.id === id);

  switch (body.action) {
    case "setStatus": {
      const m = find(body.id);
      if (!m) return json({ error: "Üye bulunamadı" }, 404);
      if (body.status === "paid") markPaid(m);
      else if (body.status === "unpaid") markUnpaid(m);
      else return json({ error: "Geçersiz durum" }, 400);
      break;
    }

    case "saveMember": {
      const fields = {
        nick: clean(body.nick, 30),
        class: clean(body.class, 30),
        owner: clean(body.owner, 40),
        discord: clean(body.discord, 40),
        note: clean(body.note, 200),
      };
      if (!fields.nick) return json({ error: "Karakter adı gerekli" }, 400);
      const dup = state.members.find(
        (x) => x.id !== body.id && x.nick.toLowerCase() === fields.nick.toLowerCase()
      );
      if (dup) return json({ error: "Bu karakter adı zaten listede" }, 409);

      if (body.id) {
        const m = find(body.id);
        if (!m) return json({ error: "Üye bulunamadı" }, 404);
        Object.assign(m, fields);
      } else {
        state.members.push({ id: newId(), ...fields, status: "unpaid", lastPaid: "" });
      }
      break;
    }

    case "deleteMember":
      state.members = state.members.filter((m) => m.id !== body.id);
      break;

    case "saveSettings":
      state.settings = {
        guildName: clean(body.guildName, 40) || state.settings.guildName,
        subtitle: clean(body.subtitle, 60) || state.settings.subtitle,
      };
      state.period.weeklyTax = clean(body.weeklyTax, 40);
      break;

    case "newPeriod":
      state.period.start = today();
      for (const m of state.members) m.status = "unpaid"; // son ödeme tarihleri korunur
      break;

    default:
      return json({ error: "Bilinmeyen işlem" }, 400);
  }

  await saveState(state);
  return json({ state: publicState(state) });
};

export const config = { path: "/api/admin" };
