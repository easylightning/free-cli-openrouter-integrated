# openrouter-free-cli

Terminal üzerinden çalışan, OpenRouter API'nin **tamamen ücretsiz** modellerini listeleyen ve bu modellerle sohbet etmenizi sağlayan bir CLI uygulaması.

> **Önemli:** Yalnızca `pricing.prompt === "0"` ve `pricing.completion === "0"` olan modeller listelenir. 0.1, 0.000001 veya herhangi bir indirimli fiyatlı model kesinlikle gösterilmez.

---

## Kurulum

### Gereksinimler

- Node.js 20+
- pnpm

### Adımlar

```bash
# 1. Bağımlılıkları yükle
pnpm install

# 2. Derle
pnpm build

# 3. Global olarak bağla
npm link
# veya
pnpm link --global
```

---

## İlk Kullanım

```bash
openrouter-free
```

İlk çalıştırmada API anahtarınız istenecektir. Anahtar maskelenmiş olarak girilir ve ekrana yansımaz.

API anahtarınızı [https://openrouter.ai/keys](https://openrouter.ai/keys) adresinden alabilirsiniz.

---

## Komutlar

### Temel Kullanım

```bash
# Chat başlat (varsayılan)
openrouter-free
openrouter-free chat

# Belirli bir modelle direkt başlat
openrouter-free chat --model <modelId>
openrouter-free chat -m google/gemma-3-27b-it:free
```

### Model Yönetimi

```bash
# Ücretsiz modelleri listele (cache kullanır)
openrouter-free models

# Cache'i yenileyerek listele
openrouter-free models --refresh
```

### Yapılandırma

```bash
# Config dosyasının yolunu göster
openrouter-free config

# API anahtarını sıfırla
openrouter-free reset-key
```

---

## Chat Komutları (REPL)

Chat modundayken şu komutları kullanabilirsiniz:

| Komut | Açıklama |
|-------|----------|
| `/exit` | Uygulamadan çık |
| `/model` | Model değiştir |
| `/clear` | Konuşma geçmişini temizle |
| `/save <dosya>` | Konuşmayı dosyaya kaydet |
| `/help` | Komutları göster |

---

## Model Listesi

Modeller bir tablo halinde gösterilir:

```
#   Güç (tahmini)   Model ID                    İsim              Bağlam   Modaliteler
1   ★★★★☆           google/gemma-3-27b-it:free  Gemma 3 27B IT    128K     text→text
2   ★★★☆☆           meta-llama/llama-3.2-3b...  Llama 3.2 3B      128K     text→text
```

**Güç puanı** şu sinyallerden hesaplanan bir tahmindir:
- Bağlam uzunluğu
- Maksimum tamamlama token sayısı
- Desteklenen parametreler (tools, reasoning vb.)
- Giriş/çıkış modaliteleri
- Model adındaki ipuçları (70b, instruct, r1, coder vb.)

> ★ Güç puanı tahminidir, resmi benchmark değildir.

---

## Yapılandırma Dosyası

Config dosyası işletim sistemine göre şu konumda saklanır:

| İşletim Sistemi | Konum |
|-----------------|-------|
| Linux | `~/.config/openrouter-free-cli/config.json` |
| macOS | `~/Library/Application Support/openrouter-free-cli/config.json` |
| Windows | `%APPDATA%\openrouter-free-cli\config.json` |

Dosya `chmod 600` ile korunur (Unix sistemlerde). Windows'ta mevcut izin mekanizmaları uygulanır.

---

## Güvenlik Notları

- API anahtarı hiçbir zaman terminale yazdırılmaz veya loglanmaz.
- Tüm hata mesajlarında API anahtarı `[REDACTED]` ile maskelenir.
- Config dosyası yalnızca sahibi tarafından okunabilir (`chmod 600`).
- `/save` komutu path traversal saldırılarına karşı korumalıdır.
- `eval`, `new Function` veya shell komut çalıştırma kullanılmaz.
- Telemetri yoktur, hiçbir veri dışarıya gönderilmez.
- Bağımlılıklar sabitlenmiş (pinned) sürümlerle tanımlanmıştır.

---

## Sadece Tamamen Ücretsiz Modeller

Bu uygulama, OpenRouter'ın `/api/v1/models` endpoint'inden model listesini çeker ve yalnızca şu koşulları sağlayan modelleri gösterir:

- `pricing.prompt` → `parseFloat === 0`
- `pricing.completion` → `parseFloat === 0`
- `pricing.request` (varsa) → `parseFloat === 0`
- `pricing.image` (varsa) → `parseFloat === 0`
- `pricing.audio` (varsa) → `parseFloat === 0`
- `pricing.web_search` (varsa) → `parseFloat === 0`
- Bilinmeyen pricing alanları (varsa) → `parseFloat === 0`

Fiyatı parse edilemeyen veya herhangi bir alanı sıfırdan farklı olan modeller **kesinlikle gösterilmez**.

---

## Sorun Giderme

### "Yapılandırma dosyası bulunamadı"
```bash
openrouter-free reset-key
```

### "Geçersiz API anahtarı"
API anahtarınızın `sk-or-v1-` ile başladığından emin olun. Yeni anahtar almak için: [https://openrouter.ai/keys](https://openrouter.ai/keys)

### "Hiç ücretsiz model bulunamadı"
```bash
openrouter-free models --refresh
```
Cache'i yenileyerek tekrar deneyin.

### "İstek zaman aşımına uğradı"
İnternet bağlantınızı kontrol edin. Varsayılan timeout 60 saniyedir.

### Build hatası
```bash
pnpm clean
pnpm install
pnpm build
```

---

## Geliştirme

```bash
# Testleri çalıştır
pnpm test

# Lint
pnpm lint

# Format
pnpm format

# Type check
pnpm typecheck
```

---

## Lisans

MIT
