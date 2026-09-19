import crypto from "node:crypto";
import { loadState, saveState, clean, newId, markPaid } from "../lib/state.mjs";

/* ---------- Discord imza doğrulaması (ed25519) ---------- */
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function verify(rawBody, signature, timestamp) {
  try {
    if (!signature || !timestamp || !process.env.DISCORD_PUBLIC_KEY) return false;
    const key = crypto.createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, Buffer.from(process.env.DISCORD_PUBLIC_KEY, "hex")]),
      format: "der",
      type: "spki",
    });
    return crypto.verify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

/* ---------- yardımcılar ---------- */
const GOLD = 0xe0a93b;

// Sadece komutu kullanan kişinin gördüğü mesaj
const reply = (content) =>
  Response.json({
    type: 4,
    data: { content, flags: 64, allowed_mentions: { parse: [] } },
  });

const isAdmin = (i) => {
  try {
    const p = BigInt(i.member?.permissions ?? "0");
    return (p & 0x8n) !== 0n || (p & 0x20n) !== 0n; // Administrator veya Manage Server
  } catch {
    return false;
  }
};

const userOf = (i) => i.member?.user ?? i.user;

/* ---------- kayıt ---------- */
function registerModal() {
  const row = (custom_id, label, required, max) => ({
    type: 1,
    components: [{ type: 4, custom_id, label, style: 1, required, max_length: max }],
  });
  return Response.json({
    type: 9,
    data: {
      custom_id: "register_modal",
      title: "Lonca Kaydı",
      components: [
        row("nick", "Karakter adı", true, 30),
        row("class", "Sınıf (isteğe bağlı)", false, 30),
        row("owner", "Sahip (boşsa Discord adın yazılır)", false, 40),
      ],
    },
  });
}

async function handleRegister(i) {
  const user = userOf(i);
  const vals = {};
  for (const row of i.data.components ?? [])
    for (const c of row.components ?? []) vals[c.custom_id] = c.value;

  const nick = clean(vals.nick, 30);
  if (nick.length < 2) return reply("Karakter adı en az 2 karakter olmalı.");
  const cls = clean(vals.class, 30);
  const owner = clean(vals.owner, 40) || user.global_name || user.username;

  const state = await loadState();
  const taken = state.members.find(
    (m) => m.nick.toLowerCase() === nick.toLowerCase() && m.discordId !== user.id
  );
  if (taken)
    return reply(`**${nick}** adı listede zaten kayıtlı. Hata olduğunu düşünüyorsan yöneticiye yaz.`);

  const existing = state.members.find((m) => m.discordId === user.id);
  if (existing) {
    Object.assign(existing, { nick, class: cls || existing.class, owner, discord: user.username });
  } else {
    state.members.push({
      id: newId(), nick, class: cls, owner, discord: user.username, discordId: user.id,
      status: "unpaid", lastPaid: "", note: "",
    });
  }
  await saveState(state);
  return reply(
    existing ? `✅ Kaydın güncellendi: **${nick}**` : `✅ Kaydın alındı, listeye eklendin: **${nick}**`
  );
}

/* ---------- ödeme ---------- */
async function handlePaid(i) {
  const user = userOf(i);
  const state = await loadState();
  const m = state.members.find((x) => x.discordId === user.id);

  if (!m) return reply("Önce kayıt odasından kayıt olmalısın, sonra tekrar dene.");
  if (m.status === "paid") return reply("Bu dönem için zaten **Ödendi** görünüyorsun 👍");
  if (m.status === "pending") return reply("Ödemen zaten yönetici onayı bekliyor.");

  if (process.env.REQUIRE_APPROVAL === "true") {
    m.status = "pending";
    await saveState(state);
    return reply("⏳ Ödeme bildirimin alındı. Yönetici onaylayınca listede **Ödendi** olacak.");
  }

  markPaid(m);
  await saveState(state);
  return reply("✅ Ödendi olarak işaretlendi, teşekkürler!");
}

/* ---------- paneller (yönetici komutları) ---------- */
function panel(title, description, label, custom_id, style) {
  const site = process.env.SITE_URL ? `\n\nListe: ${process.env.SITE_URL}` : "";
  return Response.json({
    type: 4,
    data: {
      embeds: [{ title, description: description + site, color: GOLD }],
      components: [{ type: 1, components: [{ type: 2, style, label, custom_id }] }],
    },
  });
}

/* ---------- ana giriş ---------- */
export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  if (!verify(raw, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp")))
    return new Response("invalid request signature", { status: 401 });

  const i = JSON.parse(raw);

  if (i.type === 1) return Response.json({ type: 1 }); // PING

  if (i.type === 2) {
    if (!isAdmin(i)) return reply("Bu komutu sadece yöneticiler kullanabilir.");
    if (i.data.name === "kayit-paneli")
      return panel(
        "Lonca Kaydı",
        "Aşağıdaki butona basıp karakter adını gir. Kaydın otomatik olarak vergi listesine eklenir.",
        "Kayıt Ol", "register", 1
      );
    if (i.data.name === "odeme-paneli")
      return panel(
        "Vergi Ödemesi",
        "Vergini ödedikten sonra aşağıdaki butona bas. Listedeki durumun güncellenir.",
        "Ödeme Paneli", "paid", 3
      );
  }

  if (i.type === 3) {
    if (i.data.custom_id === "register") return registerModal();
    if (i.data.custom_id === "paid") return handlePaid(i);
  }

  if (i.type === 5 && i.data.custom_id === "register_modal") return handleRegister(i);

  return reply("Bilinmeyen işlem.");
};

export const config = { path: "/api/discord" };
