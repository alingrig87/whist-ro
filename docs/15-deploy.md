# Commit 15 — Deploy to Vercel

## 🇬🇧 English

### Requirements

- Production deployment on Vercel (free tier, custom domain support)
- Environment variables set securely (not in git)
- SPA routing works on direct URL access (e.g. `/table/abc123`)
- Firebase authorized domains updated for production URL

### What Was Implemented

| File | Purpose |
|------|---------|
| `vercel.json` | SPA routing fallback + cache headers |
| `firebase.json` | Firebase CLI config (for deploying Firestore rules) |

### `vercel.json`

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

**Rewrites**: all paths → `index.html` (SPA routing). Without this, refreshing
`/table/abc123` would return a 404 from Vercel's file server.

**Cache headers**: Vite bundles assets with content hashes in filenames
(`main.abc123.js`). Since the filename changes on every build, we can safely
cache assets for 1 year (`immutable`). HTML is never cached (no headers set).

### Deployment Steps

#### 1. Push to GitHub
```bash
git remote add origin https://github.com/yourusername/whist-ro.git
git push -u origin main
```

#### 2. Connect Vercel
1. [vercel.com](https://vercel.com) → "Add New Project"
2. Import GitHub repository `whist-ro`
3. Framework preset: **Vite** (auto-detected)
4. Build command: `npm run build`
5. Output directory: `dist`

#### 3. Add Environment Variables
In Vercel → Project → Settings → Environment Variables, add all 6:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Set them for: ✅ Production, ✅ Preview, ✅ Development.

#### 4. Update Firebase Authorized Domains
Firebase Console → Authentication → Settings → Authorized domains:
- Add `whist-ro.vercel.app` (or your custom domain)
- Add `*.vercel.app` for preview deployments (optional)

#### 5. Deploy Firestore Rules
```bash
firebase login
firebase use whist-ro-xxxxx
firebase deploy --only firestore:rules
```

### Custom Domain (Optional)

1. Vercel → Project → Settings → Domains → Add
2. Add DNS records as instructed (CNAME or A record)
3. Add the custom domain to Firebase authorized domains

### Preview Deployments

Every pull request gets a unique preview URL (`https://whist-ro-pr-5.vercel.app`).
These use the same Firebase project — be careful with test data in production Firestore.

For real isolation, create a separate Firebase project for staging and add
`VITE_FIREBASE_*` environment variables scoped to "Preview" environment only.

---

## 🇷🇴 Română

### Cerințe

- Deploy pe Vercel (tier gratuit, suport domeniu custom)
- Variabile de mediu setate securizat (nu în git)
- Rutarea SPA funcționează la acces direct URL
- Domenii autorizate Firebase actualizate pentru URL-ul de producție

### `vercel.json`

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Rewrites**: toate path-urile → `index.html` (rutare SPA). Fără asta, refresh
pe `/table/abc123` ar returna 404 de la file server-ul Vercel.

**Cache headers**: Vite bundlează assets cu hash-uri în nume de fișiere
(`main.abc123.js`). Cum numele se schimbă la fiecare build, putem cache-ui
assets 1 an (`immutable`). HTML nu se cache-uiește niciodată.

### Pașii de deployment

#### 1. Push pe GitHub
```bash
git remote add origin https://github.com/yourusername/whist-ro.git
git push -u origin main
```

#### 2. Conectează Vercel
1. vercel.com → "Add New Project" → Importă repo
2. Framework preset: **Vite** (auto-detectat)
3. Build: `npm run build`, Output: `dist`

#### 3. Adaugă variabilele de mediu
În Vercel → Project → Settings → Environment Variables, adaugă cele 6 variabile
`VITE_FIREBASE_*`. Bifează: ✅ Production, ✅ Preview, ✅ Development.

#### 4. Actualizează domeniile autorizate Firebase
Firebase Console → Authentication → Settings → Authorized domains:
- Adaugă `whist-ro.vercel.app` (sau domeniul tău custom)

#### 5. Deploy reguli Firestore
```bash
firebase deploy --only firestore:rules
```

### Preview deployments

Fiecare pull request primește un URL preview unic (`whist-ro-pr-5.vercel.app`).
Acestea folosesc același proiect Firebase — ai grijă cu datele de test în Firestore-ul de producție.
