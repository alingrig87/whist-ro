# Commit 14 — Firestore Security Rules

## 🇬🇧 English

### Requirements

- Game hands are private: only the owner can read their cards
- Only authenticated users can play
- Players can only modify their own data (bid, play card)
- Group data is only accessible to group members
- Prevent writing to finished games (read-only archive)

### The Rules

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helper functions ──────────────────────────────────────────────────
    function isAuth() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return request.auth.uid == uid;
    }

    function isMember(groupId) {
      return isAuth() &&
        request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.memberUids;
    }

    function isTablePlayer(tableId) {
      return isAuth() &&
        exists(/databases/$(database)/documents/tables/$(tableId)/players/$(request.auth.uid));
    }

    // ── Users ─────────────────────────────────────────────────────────────
    match /users/{uid} {
      allow read:   if isAuth();
      allow create: if isOwner(uid);
      allow update: if isOwner(uid);
      allow delete: if false;  // profiles are permanent
    }

    // ── Tables ────────────────────────────────────────────────────────────
    match /tables/{tableId} {
      allow read:   if isAuth();
      allow create: if isAuth();
      allow update: if isTablePlayer(tableId);
      allow delete: if isAuth() &&
                    resource.data.createdBy == request.auth.uid &&
                    resource.data.status == 'waiting';  // only delete waiting tables
    }

    // Players subcollection
    match /tables/{tableId}/players/{uid} {
      allow read:   if isAuth();
      allow write:  if isAuth() && (
        isOwner(uid) ||                    // join/leave yourself
        get(/databases/$(database)/documents/tables/$(tableId)).data.createdBy == request.auth.uid  // host can kick
      );
    }

    // Rounds subcollection
    match /tables/{tableId}/rounds/{roundId} {
      allow read:  if isAuth();
      allow write: if isTablePlayer(tableId);
    }

    // !! PRIVATE: Card hands — only the owner can read their own hand !!
    match /tables/{tableId}/hands/{uid} {
      allow read:  if isOwner(uid);   // only you see your cards
      allow write: if isTablePlayer(tableId);  // any player can write (dealing)
    }

    // ── Games (archive — read-only after creation) ─────────────────────
    match /games/{gameId} {
      allow read:   if isAuth();
      allow create: if isAuth();  // written at game end
      allow update: if false;     // immutable after creation
      allow delete: if false;
    }

    // ── Groups ────────────────────────────────────────────────────────────
    match /groups/{groupId} {
      allow read:   if isMember(groupId);
      allow create: if isAuth();
      allow update: if isMember(groupId);  // members can update (e.g. invite code refresh)
      allow delete: if isAuth() &&
                    resource.data.createdBy == request.auth.uid;
    }

    match /groups/{groupId}/members/{uid} {
      allow read:   if isMember(groupId);
      allow write:  if isAuth() && (
        isOwner(uid) ||   // join/leave yourself
        get(/databases/$(database)/documents/groups/$(groupId)).data.createdBy == request.auth.uid
      );
    }
  }
}
```

### Security Decisions Explained

#### Private Hands: `allow read: if isOwner(uid)`

This is the most critical rule. The hands path is `tables/{tableId}/hands/{uid}`.
Only the user whose UID matches the document ID can read it. Other players,
even if they're at the same table, cannot read each other's cards.

**What about cheating?** A determined cheater could:
1. Look at network requests — but Firestore security rules block this at the server
2. Modify Firestore writes to play illegal cards — the `isTablePlayer` check ensures
   only active players write, but doesn't validate card legality

For a game between friends, this level of security is sufficient. Implementing
server-side card validation would require Cloud Functions.

#### Table Deletion: Only While Waiting

`resource.data.status == 'waiting'` — you can't delete a game in progress.
This prevents the host from rage-quitting and destroying everyone's session.

#### Games Archive: Immutable

`update: if false; delete: if false` — game results are permanent.
This prevents score manipulation after the fact.

#### `isMember` Helper: One Extra Read

The `isMember` function does `get(...)` which counts as a Firestore read.
Firestore bills per document read, including reads in security rules.
Keep this in mind: every group-protected write costs 1 extra read for the rule check.

### Deploying Rules

**Option A — Firebase Console:**
1. Firebase Console → Firestore → Rules
2. Paste `firestore.rules` content
3. Click **Publish**

**Option B — Firebase CLI:**
```bash
npm install -g firebase-tools
firebase login
firebase use whist-ro-xxxxx
firebase deploy --only firestore:rules
```

---

## 🇷🇴 Română

### Cerințe

- Mâinile de cărți sunt private: doar proprietarul poate citi propriile cărți
- Doar utilizatorii autentificați pot juca
- Jucătorii pot modifica doar propriile date (licitație, joacă carte)
- Datele grupurilor sunt accesibile doar membrilor
- Jocurile arhivate sunt read-only

### Decizii de securitate explicate

#### Mâini private: `allow read: if isOwner(uid)`

Aceasta e regula critică. Path-ul mâinilor e `tables/{tableId}/hands/{uid}`.
Doar utilizatorul al cărui UID coincide cu ID-ul documentului poate citi.
Ceilalți jucători, chiar dacă sunt la aceeași masă, nu pot citi cărțile altora.

**Ce zici de trișat?** Un trișor determinat ar putea:
1. Inspecta request-urile de rețea — dar regulile Firestore blochează asta la server
2. Modifica write-urile Firestore pentru cărți ilegale — verificarea `isTablePlayer`
   asigură că doar jucătorii activi scriu, dar nu validează legalitatea cărții

Pentru un joc între prieteni, acest nivel de securitate e suficient.

#### Ștergerea mesei: doar în așteptare

`resource.data.status == 'waiting'` — nu poți șterge un joc în progres.
Previne host-ul să iasă furios și să distrugă sesiunea tuturor.

#### Arhiva jocurilor: imuabilă

`update: if false; delete: if false` — rezultatele jocurilor sunt permanente.
Previne manipularea scorurilor după finalizare.

#### Helper-ul `isMember`: un read extra

Funcția `isMember` face `get(...)` — un document read taxat de Firestore.
Ține cont: fiecare write protejat de grup costă 1 read extra pentru verificarea regulii.
