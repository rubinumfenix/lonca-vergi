# Lonca Vergi Defteri

Discord'dan kayıt olan üyelerin listelendiği, "Ödendi" butonuyla güncellenen vergi takip sitesi.
Tamamı Netlify üzerinde çalışır (ücretsiz plan yeter), ayrı sunucu veya 7/24 açık bot gerekmez.

```
public/index.html            → site (liste, arama, yönetici paneli)
netlify/functions/state.mjs  → listeyi verir (/api/state)
netlify/functions/admin.mjs  → yönetici girişi ve düzenleme (/api/admin)
netlify/functions/discord.mjs→ Discord butonları ve komutları (/api/discord)
scripts/register-commands.mjs→ Discord komutlarını bir kez kaydeder
```

Veri Netlify Blobs'ta tutulur (ek hesap gerekmez).

## Kurulum

### 1) Discord uygulaması
1. https://discord.com/developers/applications → **New Application**.
2. **General Information** sayfasından **Application ID** ve **Public Key** değerlerini kopyala.
3. **Bot** sekmesi → **Reset Token** → token'ı kopyala (kimseyle paylaşma).
4. **OAuth2 → URL Generator**: `applications.commands` ve `bot` kutularını işaretle, çıkan linkle uygulamayı sunucuna ekle.
5. Discord'da **Ayarlar → Gelişmiş → Geliştirici Modu**'nu aç, sunucu ikonuna sağ tıklayıp **Sunucu ID'sini kopyala**.

### 2) Netlify'a yükleme
Klasörü GitHub'a yükleyip Netlify'da **Add new site → Import from Git** ile bağla
(veya bilgisayarında `npx netlify deploy --prod`).
Sürükle-bırak yöntemi fonksiyonları çalıştırmaz, o yüzden kullanma.

**Site settings → Environment variables** bölümüne şunları ekle:

| Ad | Değer |
|---|---|
| `DISCORD_PUBLIC_KEY` | Discord'dan kopyaladığın Public Key |
| `ADMIN_PASSWORD` | Sitede yönetici girişi için seçtiğin şifre (uzun ve tahmin edilmesi zor olsun) |
| `SITE_URL` | (isteğe bağlı) `https://siten.netlify.app`, Discord panellerinde link olarak görünür |
| `REQUIRE_APPROVAL` | (isteğe bağlı) `true` yaparsan üye "Ödendi"ye basınca durum **Onay bekliyor** olur, yönetici sitede onaylar |

Değişkenleri ekledikten sonra siteyi yeniden deploy et.

### 3) Discord'a endpoint'i tanıt
Developer Portal → **General Information → Interactions Endpoint URL**:

```
https://siten.netlify.app/api/discord
```

Kaydettiğinde Discord test isteği gönderir. Hata verirse Public Key'i ve deploy'u kontrol et.

### 4) Komutları kaydet (bir kez)
Bilgisayarında bu klasörde (Node 18+):

```
DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... node scripts/register-commands.mjs
```

(Windows PowerShell: önce `$env:DISCORD_APP_ID="..."` şeklinde üç değişkeni tanımla, sonra `node scripts/register-commands.mjs`.)

### 5) Panelleri kur
- Kayıt odasında `/kayit-paneli` yaz → **Kayıt Ol** butonlu mesaj çıkar.
- Ödeme odasında `/odeme-paneli` yaz → **Ödendi** butonlu mesaj çıkar.

Komutları sadece "Sunucuyu Yönet" veya yönetici yetkisi olanlar kullanabilir. Paneller bir kez atılır, butonlar kalıcı çalışır.

## Nasıl çalışır?
- **Kayıt Ol** → açılan formda karakter adı (zorunlu), sınıf ve sahip girilir → üye anında listeye düşer. Aynı kişi tekrar kayıt olursa kaydı güncellenir; aynı karakter adı iki kez eklenemez.
- **Ödendi** → butona basan kişinin kendi satırı güncellenir (başkasını işaretleyemez). Kayıtlı değilse uyarı alır.
- **Yönetici Girişi** (sitede) → ödendi/ödenmedi işaretleme, üye ekleme/düzenleme/silme, lonca adı ve haftalık vergi ayarı, **Yeni dönem** (herkesi ödenmedi yapar, son ödeme tarihleri kalır).
- Site 30 saniyede bir listeyi kendiliğinden yeniler.

## Notlar
- `REQUIRE_APPROVAL` kapalıyken ödeme beyanı kişinin kendi butonuna güvenir; kimin gerçekten ödediğini kontrol etmek istiyorsan açık tut.
- Sitenin verisini yedeklemek için yönetici panelinden değil, Netlify Blobs'tan (`vergi-defteri` deposu, `state` anahtarı) alabilirsin.
