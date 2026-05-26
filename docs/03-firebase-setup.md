# Commit 03 — Firebase Setup: Project + Firestore + Auth

## 🇬🇧 English

### Requirements

Firebase provides the entire backend:
- **Authentication** — Google Sign-In (required; no anonymous play)
- **Firestore** — real-time database for game state, groups, leaderboard
- **Hosting** (optional) — we use Vercel, but firebase.json is kept for rules deploy

### Step-by-Step Firebase Project Creation

#### 1. Create the project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Name it `whist-ro` (or anything you like)
4. Disable Google Analytics (not needed)
5. Click **"Create project"**

#### 2. Add a Web App
1. On the project homepage, click the **`</>`** (Web) icon
2. Register app name: `whist-ro-web`
3. **Do NOT** enable Firebase Hosting (we use Vercel)
4. Copy the config object — you'll need it for `.env.local`

#### 3. Enable Firestore
1. Firestore Database → **"Create database"**
2. Choose **Production mode** (we write rules from scratch in commit 14)
3. Region: `europe-west3` (Frankfurt — lowest latency for Romania)

#### 4. Enable Authentication
1. Authentication → **"Get started"**
2. Sign-in providers → **Google** → Enable
3. Set your support email
4. Save

#### 5. Authorized Domains
In Authentication → Settings → Authorized domains:
- `localhost` is already there (for dev)
- Add your production domain (e.g. `whist-ro.vercel.app`) after deploy

#### 6. Environment Variables
Create `.env.local` (gitignored — never commit this file):

```bash
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=whist-ro-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=whist-ro-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=whist-ro-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

All values come from the Web App config object you copied in step 2.

### `src/lib/firebase.ts`

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

### Why `import.meta.env` (not `process.env`)

Vite replaces `import.meta.env.VITE_*` at **build time** with the actual values.
`process.env` is a Node.js concept — it doesn't exist in the browser.
The `VITE_` prefix is mandatory; Vite strips variables without it from the bundle
(security: server-only secrets never leak to the client).

### Firebase Code Splitting

Firebase SDK is ~460 KB. We split it into a separate chunk so browsers cache it
independently of app code (Firebase changes rarely compared to your components):

```typescript
// vite.config.ts
manualChunks: {
  firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
}
```

---

## 🇷🇴 Română

### Pași pentru crearea proiectului Firebase

#### 1. Creare proiect
1. [console.firebase.google.com](https://console.firebase.google.com)
2. **"Add project"** → Nume: `whist-ro`
3. Dezactivează Google Analytics
4. **"Create project"**

#### 2. Adaugă Web App
1. Click iconița **`</>`** pe homepage
2. Nume: `whist-ro-web`
3. **NU** activa Firebase Hosting (folosim Vercel)
4. Copiază obiectul config

#### 3. Activează Firestore
1. Firestore Database → **"Create database"**
2. Alege **Production mode** (scriem reguli manual în commit 14)
3. Regiune: `europe-west3` (Frankfurt — cea mai mică latență pentru România)

#### 4. Activează Autentificarea
1. Authentication → **"Get started"**
2. Sign-in providers → **Google** → Enable
3. Setează email-ul de suport
4. Save

#### 5. Domenii autorizate
În Authentication → Settings → Authorized domains:
- `localhost` e deja acolo (pentru dev)
- Adaugă domeniul de producție după deploy

#### 6. Variabile de mediu
Creează `.env.local` (gitignored — nu commite niciodată acest fișier):

```bash
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=whist-ro-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=whist-ro-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=whist-ro-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### De ce `import.meta.env` (nu `process.env`)

Vite înlocuiește `import.meta.env.VITE_*` la **build time** cu valorile reale.
`process.env` e un concept Node.js — nu există în browser.
Prefixul `VITE_` e obligatoriu; variabilele fără el sunt excluse din bundle
(securitate: secretele server nu ajung niciodată la client).
