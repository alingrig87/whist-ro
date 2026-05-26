# Commit 04 — Google Auth (Required Login)

## 🇬🇧 English

### Requirements

Unlike tabla-mate where login is optional, whist-ro **requires** authentication:
- Game results must be attributed to real accounts for the leaderboard
- Groups work by email — anonymous users can't be invited
- A user profile is created in Firestore on first login

### What Was Implemented

| File | Purpose |
|------|---------|
| `src/context/AuthContext.tsx` | Firebase auth state + user profile sync |
| `src/components/LoginPage.tsx` | Full-page sign-in with Google button |
| `src/App.tsx` | Protected routes — redirect to /login if not auth |
| `src/lib/users.ts` | Firestore user profile CRUD |

### AuthContext Pattern

```typescript
interface AuthContextValue {
  user: User | null          // Firebase Auth user
  profile: UserProfile | null // Firestore /users/{uid} doc
  loading: boolean           // true until Firebase resolves auth state
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}
```

Two separate objects:
- `user` — Firebase Auth (email, displayName, photoURL, uid) — authoritative identity
- `profile` — Firestore `/users/{uid}` — game stats, last seen, preferences

#### Why keep them separate?
Firebase Auth data is managed by Google (immutable from our side).
Game stats live in Firestore where we control reads/writes. Merging them into
one object would require re-syncing Auth data on every Firestore write.

### First Login: Profile Creation

```typescript
// On first Google sign-in, create /users/{uid} if it doesn't exist
async function ensureUserProfile(user: User) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
      totalGames: 0,
      totalWins: 0,
      totalScore: 0,
    })
  }
}
```

We use `setDoc` with a check (not `setDoc` with merge) so we never overwrite
accumulated stats if the user somehow triggers this twice.

### Protected Routes

```tsx
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

`replace` in `Navigate` means the login page doesn't push onto the history stack —
hitting Back after login goes to the page before /login, not back to /login.

### `signInWithPopup` vs `signInWithRedirect`

| | Popup | Redirect |
|---|---|---|
| Flow | Google opens in popup window | Full-page redirect to Google |
| Mobile | ⚠ Some browsers block popups | ✅ Works everywhere |
| UX | ✅ User stays on page | ⚠ Full page reload |
| Implementation | Simpler | Requires handling redirect result |

We use **popup** for desktop convenience. On mobile, if popups are blocked,
Firebase automatically falls back to redirect flow.

---

## 🇷🇴 Română

### Cerințe

Spre deosebire de tabla-mate unde login-ul era opțional, whist-ro **necesită**
autentificare obligatorie:
- Rezultatele jocurilor trebuie atribuite unor conturi reale pentru clasament
- Grupurile funcționează prin email — utilizatorii anonimi nu pot fi invitați
- Un profil Firestore e creat la primul login

### Ce s-a implementat

| Fișier | Scop |
|--------|------|
| `src/context/AuthContext.tsx` | Starea auth Firebase + sync profil utilizator |
| `src/components/LoginPage.tsx` | Pagina de sign-in cu buton Google |
| `src/App.tsx` | Rute protejate — redirect la /login dacă nu ești auth |
| `src/lib/users.ts` | CRUD profil utilizator în Firestore |

### Pattern-ul AuthContext

```typescript
interface AuthContextValue {
  user: User | null           // Utilizatorul Firebase Auth
  profile: UserProfile | null // Documentul Firestore /users/{uid}
  loading: boolean            // true până Firebase rezolvă starea auth
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}
```

Două obiecte separate:
- `user` — Firebase Auth (email, displayName, photoURL, uid) — identitate autorativă
- `profile` — Firestore `/users/{uid}` — statistici jocuri, preferințe

#### De ce separate?
Datele Firebase Auth sunt gestionate de Google (imutabile din partea noastră).
Statisticile jocului stau în Firestore unde noi controlăm read/write.

### Creare profil la primul login

La prima autentificare Google, se creează `/users/{uid}` dacă nu există.
Folosim verificare cu `getDoc` înainte de `setDoc` pentru a nu suprascrie
niciodată statisticile acumulate.

### Rute protejate

```tsx
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

`replace` în `Navigate` înseamnă că pagina /login nu intră în stack-ul de history —
apăsând Back după login mergi la pagina de dinainte, nu înapoi la /login.

### `signInWithPopup` vs `signInWithRedirect`

Folosim **popup** pentru confort pe desktop. Pe mobile, dacă popup-urile sunt blocate,
Firebase face fallback automat la redirect.
