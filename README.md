# Lemmy Dizini

Dağınık Türkçe Lemmy toplulukları için tek bir dizin.

## Topluluk ekleme

### Issue formu

[Yeni issue](../../issues/new/choose) aç, **"Topluluk ekle"** formunu doldur. Bir yetkili onayladıktan sonra topluluğun dizine eklenir.

### Pull request

`communities/<isim>.json` oluşturup PR aç:

```json
{
  "handle": "isim@instance.tld",
  "name": "İsim",
  "description": "Genel sohbet topluluğu."
}
```

| Alan          | Zorunlu | Açıklama                                                 |
| ------------- | ------- | -------------------------------------------------------- |
| `handle`      | evet    | `isim@instance.tld` biçiminde. Tek zorunlu alan.         |
| `name`        | hayır   | Görünen isim. Boşsa topluluğun Lemmy'deki adı kullanılır. |
| `description` | hayır   | Kısa açıklama.                                            |

Dosya adı URL olur (`/c/<isim>/`).

## Yerel geliştirme

Node.js 18+ gerekir.

```bash
node build.js                                          # dist/ üret
python3 -m http.server 8080 --bind 0.0.0.0 -d dist     # http://0.0.0.0:8080
# ya da kısaca:
npm run dev
```

## Dağıtım (Cloudflare Pages)

- **Build komutu:** `node build.js`
- **Çıktı dizini:** `dist`

## Lisans

[GNU AGPL v3](LICENSE)
