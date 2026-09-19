// Kullanım (bir kez çalıştırman yeterli):
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... node scripts/register-commands.mjs

const { DISCORD_APP_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_APP_ID || !DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
  console.error("DISCORD_APP_ID, DISCORD_BOT_TOKEN ve DISCORD_GUILD_ID gerekli.");
  process.exit(1);
}

const commands = [
  {
    name: "kayit-paneli",
    description: "Bu kanala 'Kayıt Ol' butonunu koyar (yönetici)",
    default_member_permissions: "32", // Manage Server
  },
  {
    name: "odeme-paneli",
    description: "Bu kanala 'Ödendi' butonunu koyar (yönetici)",
    default_member_permissions: "32",
  },
];

const res = await fetch(
  `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`,
  {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    body: JSON.stringify(commands),
  }
);
console.log(res.status, res.ok ? "Komutlar kaydedildi." : await res.text());
