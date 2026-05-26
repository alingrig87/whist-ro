# Commit 12 — Groups (Cercuri de Jucători)

## 🇬🇧 English

### Requirements

- Users can create named groups (e.g. "Familia Grigorescu", "Colegii de birou")
- Join a group via 6-character invite code
- Group leaderboard tracks stats across all games played within the group
- Host can tag a table as belonging to a group when creating it
- Group admin can remove members or delete the group

### What Was Implemented

| File | Purpose |
|------|---------|
| `src/components/Groups/GroupsPage.tsx` | List user's groups + create button |
| `src/components/Groups/CreateGroupModal.tsx` | Create group form |
| `src/components/Groups/GroupDetail.tsx` | Group page: members + leaderboard |
| `src/lib/groups.ts` | Firestore CRUD for groups |

### Invite Code System

```typescript
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I,O,0,1 (confusing)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
```

Excluded characters: `I`, `O`, `0`, `1` — visually ambiguous in most fonts.
Result: codes like `KMPW4R`, easy to share verbally.

### Creating a Group

```typescript
async function createGroup(
  name: string,
  description: string,
  creatorUid: string,
  creatorProfile: UserProfile
): Promise<string> {
  let inviteCode = generateInviteCode()

  // Ensure invite code is unique (collision extremely unlikely but handled)
  while (await inviteCodeExists(inviteCode)) {
    inviteCode = generateInviteCode()
  }

  const ref = doc(collection(db, 'groups'))
  await setDoc(ref, {
    name,
    description,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    inviteCode,
    memberUids: [creatorUid],
  })

  // Add creator as admin member
  await setDoc(doc(db, 'groups', ref.id, 'members', creatorUid), {
    displayName: creatorProfile.displayName,
    photoURL: creatorProfile.photoURL,
    role: 'admin',
    joinedAt: serverTimestamp(),
    gamesPlayed: 0,
    wins: 0,
    totalScore: 0,
  })

  return ref.id
}
```

### Joining via Invite Code

```typescript
async function joinGroupByCode(
  code: string,
  uid: string,
  profile: UserProfile
): Promise<string> {
  // Query: find group with this invite code
  const q = query(
    collection(db, 'groups'),
    where('inviteCode', '==', code.toUpperCase()),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('Cod de invitație invalid')

  const groupDoc = snap.docs[0]
  const groupId = groupDoc.id

  // Check not already a member
  if (groupDoc.data().memberUids.includes(uid)) {
    throw new Error('Ești deja în acest grup')
  }

  const batch = writeBatch(db)

  // Add uid to memberUids array
  batch.update(doc(db, 'groups', groupId), {
    memberUids: arrayUnion(uid),
  })

  // Create member subdocument
  batch.set(doc(db, 'groups', groupId, 'members', uid), {
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    role: 'member',
    joinedAt: serverTimestamp(),
    gamesPlayed: 0,
    wins: 0,
    totalScore: 0,
  })

  await batch.commit()
  return groupId
}
```

### `memberUids` Array (Denormalized)

The `memberUids` array on the group document serves as a quick membership check:
- **Security rules**: `request.auth.uid in resource.data.memberUids`
- **Quick check**: no subcollection read needed

The `members/{uid}` subcollection holds detailed per-member stats.
Two sources of truth are kept in sync via batched writes.

### Group Leaderboard Query

```typescript
// Get top members sorted by totalScore
query(
  collection(db, 'groups', groupId, 'members'),
  orderBy('totalScore', 'desc'),
  limit(50)
)
```

### Group-Tagged Tables

When creating a table, the user can optionally link it to one of their groups:

```tsx
<select value={selectedGroupId} onChange={...}>
  <option value="">Fără grup (joc public)</option>
  {myGroups.map(g => (
    <option key={g.id} value={g.id}>{g.name}</option>
  ))}
</select>
```

Only group members see their group's results on the group leaderboard.

---

## 🇷🇴 Română

### Cerințe

- Utilizatorii pot crea grupuri cu nume (ex: "Familia Grigorescu")
- Se alătură unui grup prin cod de invitație din 6 caractere
- Clasamentul grupului urmărește statistici din toate jocurile grupului
- Host-ul poate eticheta o masă ca aparținând unui grup

### Sistemul de coduri de invitație

```typescript
// Caractere fără I, O, 0, 1 (vizual ambigue)
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
```

Rezultat: coduri ca `KMPW4R`, ușor de share verbal.

### Array-ul `memberUids` (denormalizat)

Serveșe ca verificare rapidă de apartenență:
- **Security rules**: `request.auth.uid in resource.data.memberUids`
- **Fără citire subcollecție** pentru a verifica dacă cineva e membru

Subcollecția `members/{uid}` conține statisticile detaliate per membru.
Ambele surse sunt ținute în sync prin `writeBatch`.

### Mese etichetate cu grup

La crearea mesei, utilizatorul poate opțional lega masa de unul din grupurile sale.
Doar membrii grupului văd rezultatele jocului pe clasamentul grupului.
