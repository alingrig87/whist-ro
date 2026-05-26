# Commit 13 — Leaderboard

## 🇬🇧 English

### Requirements

- Global leaderboard: top players by total score / win rate / games played
- Group leaderboard: same metrics, scoped to group members
- Game history: list of past games with per-player results
- Recent games feed on home page

### What Was Implemented

| File | Purpose |
|------|---------|
| `src/components/Leaderboard/LeaderboardPage.tsx` | Global leaderboard with tabs |
| `src/components/Groups/GroupDetail.tsx` | Group leaderboard (reuses same component) |
| `src/lib/leaderboard.ts` | Firestore queries for rankings |

### Global Leaderboard Queries

```typescript
// Top by total score (all-time)
query(collection(db, 'users'), orderBy('totalScore', 'desc'), limit(50))

// Top by win rate (requires composite index)
// Calculated client-side: wins / totalGames (avoid divide-by-zero)
function winRate(u: UserProfile): number {
  return u.totalGames > 0 ? u.totalWins / u.totalGames : 0
}
```

### Why No `winRate` Field in Firestore

Storing a computed ratio in Firestore creates a consistency problem:
- On every game finish, you'd need to update `winRate` atomically with `totalWins`
- If the formula changes, all existing documents are stale

Instead: store raw counters (`totalWins`, `totalGames`) and compute ratio client-side.
Firestore queries sort by raw fields; the top-50 by score is a good proxy.

### Composite Index Requirements

```
// Query: users ordered by totalScore (descending)
// Firestore auto-creates single-field indexes, so no explicit index needed here.

// Query: games filtered by groupId + ordered by finishedAt
// Requires a composite index: groupId ASC + finishedAt DESC
// Created in Firebase Console → Firestore → Indexes
```

The error message when a composite index is missing includes a direct link
to create it — click the link, wait ~1 minute for index to build.

### Recent Games Feed

```typescript
// Last 10 games (global)
query(collection(db, 'games'), orderBy('finishedAt', 'desc'), limit(10))

// Last 10 games for a specific group
query(
  collection(db, 'games'),
  where('groupId', '==', groupId),
  orderBy('finishedAt', 'desc'),
  limit(10)
)
```

### Leaderboard Tabs

```
┌──────────────────────────────────────────────────┐
│  🏆 Clasament Global                             │
│  [Scor total] [Victorii] [Jocuri]               │
├──────────────────────────────────────────────────┤
│  #1  👤 Alin Grigorescu    1240 pct  12/15 vic  │
│  #2  👤 Carmen Pop          980 pct   8/13 vic  │
│  #3  👤 Andrei Ionescu       870 pct  11/18 vic  │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

Three sort modes (tab-based):
1. **Scor total** — `totalScore` descending
2. **% Victorii** — `wins/games` descending (min 3 games to qualify)
3. **Jocuri jucate** — `totalGames` descending

### Player Card in Leaderboard

```tsx
<div className="leaderboard-row">
  <span className="rank">#{rank}</span>
  <img src={photoURL} className="avatar" />
  <div className="player-info">
    <span className="name">{displayName}</span>
    <span className="stats">{totalGames} jocuri • {totalWins} victorii</span>
  </div>
  <span className="score">{totalScore} pct</span>
</div>
```

---

## 🇷🇴 Română

### Cerințe

- Clasament global: top jucători după scor total / % victorii / jocuri jucate
- Clasament grup: aceleași metrici, filtrate la membrii grupului
- Istoricul jocurilor: lista jocurilor trecute cu rezultate per jucător
- Feed jocuri recente pe pagina principală

### De ce nu stocăm `winRate` în Firestore

Stocarea unui raport calculat creează o problemă de consistență:
- La fiecare finalizare de joc, ar trebui să actualizezi `winRate` atomic cu `totalWins`
- Dacă formula se schimbă, toate documentele existente sunt invalide

Soluție: stocăm contoare brute (`totalWins`, `totalGames`) și calculăm raportul client-side.

### Index-uri compuse necesare

```
// games filtrate după groupId + ordonate după finishedAt
// Necesită index compus: groupId ASC + finishedAt DESC
// Creat în Firebase Console → Firestore → Indexes
```

Mesajul de eroare când lipsește un index compus include un link direct
pentru crearea lui — click pe link, aștepți ~1 minut.

### 3 moduri de sortare (tab-based)

1. **Scor total** — `totalScore` descrescător
2. **% Victorii** — `wins/games` descrescător (min 3 jocuri pentru calificare)
3. **Jocuri jucate** — `totalGames` descrescător
