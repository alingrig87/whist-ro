# Commit 11 — Scoring: Per-Round + Cumulative

## 🇬🇧 English

### Requirements

- After each round, calculate each player's score delta
- Display round summary with per-player results
- Accumulate scores in `tables/{tableId}.scores`
- After the last round, finalize game and save to `games/{gameId}`

### What Was Implemented

| File | Purpose |
|------|---------|
| `src/lib/scoring.ts` | Score calculation functions |
| `src/components/Game/ScoreBoard.tsx` | Live score tracker during game |
| `src/components/Game/RoundSummary.tsx` | Post-round breakdown modal |

### Scoring Formula: Standard Romanian Whist

```typescript
function calculateRoundScore(bid: number, tricksWon: number): number {
  if (bid === tricksWon) {
    return 5 + bid          // Hit exactly: 5 bonus + number of tricks won
  }
  return -Math.abs(bid - tricksWon)  // Miss: minus the difference
}
```

**Examples:**
| Bid | Won | Score |
|-----|-----|-------|
| 3 | 3 | **+8** (5+3) |
| 0 | 0 | **+5** (5+0) |
| 2 | 4 | **-2** (-|2-4|) |
| 3 | 1 | **-2** (-|3-1|) |
| 5 | 0 | **-5** (-|5-0|) |

Bidding 0 and succeeding gives +5 (not 0!) — this rewards accurate prediction
even when you're trying to get nothing.

### Applying Round Scores

```typescript
async function applyRoundScores(
  tableId: string,
  roundIndex: number,
  round: RoundState,
  playerOrder: string[],
  currentScores: Record<string, number>
): Promise<void> {
  const deltas: Record<string, number> = {}
  for (const uid of playerOrder) {
    deltas[uid] = calculateRoundScore(round.bids[uid], round.tricksWon[uid])
  }

  const newScores: Record<string, number> = {}
  for (const uid of playerOrder) {
    newScores[uid] = (currentScores[uid] ?? 0) + deltas[uid]
  }

  const isLastRound = roundIndex === 14  // 15 rounds total (0-14)
  const batch = writeBatch(db)

  // Update cumulative scores on table
  batch.update(doc(db, 'tables', tableId), { scores: newScores })

  if (isLastRound) {
    // Mark table as finished
    batch.update(doc(db, 'tables', tableId), { status: 'finished' })

    // Save game to archive
    const gameRef = doc(collection(db, 'games'))
    const winner = playerOrder.reduce((a, b) => newScores[a] > newScores[b] ? a : b)
    batch.set(gameRef, {
      tableId,
      groupId: table.groupId,
      players: playerOrder.map((uid, i) => ({
        uid,
        displayName: players[uid].displayName,
        photoURL: players[uid].photoURL,
        score: newScores[uid],
        rank: getRanks(newScores, playerOrder)[uid],
      })),
      winner,
      finishedAt: serverTimestamp(),
      totalRounds: 15,
    })

    // Update user stats
    for (const uid of playerOrder) {
      batch.update(doc(db, 'users', uid), {
        totalGames: increment(1),
        totalScore: increment(deltas[uid]),
        totalWins: winner === uid ? increment(1) : increment(0),
      })
    }

    // If group game, update group member stats
    if (table.groupId) {
      for (const uid of playerOrder) {
        batch.update(doc(db, 'groups', table.groupId, 'members', uid), {
          gamesPlayed: increment(1),
          totalScore: increment(newScores[uid]),
          wins: winner === uid ? increment(1) : increment(0),
        })
      }
    }
  } else {
    // Start next round
    await createRound(tableId, roundIndex + 1, playerOrder)
    batch.update(doc(db, 'tables', tableId), { currentRound: roundIndex + 1 })
  }

  await batch.commit()
}
```

### `getRanks` Function

```typescript
function getRanks(
  scores: Record<string, number>,
  playerOrder: string[]
): Record<string, number> {
  const sorted = [...playerOrder].sort((a, b) => scores[b] - scores[a])
  const ranks: Record<string, number> = {}
  sorted.forEach((uid, i) => {
    // Handle ties: same score = same rank
    if (i > 0 && scores[uid] === scores[sorted[i-1]]) {
      ranks[uid] = ranks[sorted[i-1]]
    } else {
      ranks[uid] = i + 1
    }
  })
  return ranks
}
```

### ScoreBoard Component

Shows during the game:

```
╔══════════════════════════════╗
║  Scoreboard  Runda 5/15      ║
╠══════════════════════════════╣
║  Alin     Licitație: 2  ✓ 2  ║  +8 → 34
║  Carmen   Licitație: 1  ✗ 0  ║  -1 → 12
║  Andrei   Licitație: 3  ⋯    ║  --- 25
╚══════════════════════════════╝
```

- ✓ = hit, ✗ = miss, ⋯ = still playing

### RoundSummary Modal

After each round, a modal shows before advancing:

```
Runda 5 completă  (5 cărți/jucător, atu: ♥)
─────────────────────────────────────────
Alin    licitat: 2  câștigat: 2   +8  total: 34
Carmen  licitat: 1  câștigat: 0   -1  total: 12
Andrei  licitat: 3  câștigat: 3   +8  total: 33
─────────────────────────────────────────
[Continuă →]
```

Only visible to the host, who clicks "Continue" to advance.

---

## 🇷🇴 Română

### Cerințe

- Calculează delta de scor per jucător după fiecare rundă
- Afișează sumar rundă cu rezultate per jucător
- Acumulează scoruri în `tables/{tableId}.scores`
- După ultima rundă, finalizează jocul și salvează în `games/{gameId}`

### Formula de scoring: Whist Românesc Standard

```
Nimerești (bid == won): +5 + bid
Ratezi:                 -(|bid - won|)
```

**Exemple:**
- Licitezi 3, câștigi 3 → **+8** (5+3)
- Licitezi 0, câștigi 0 → **+5** (5+0) ← zero levate recompensate!
- Licitezi 2, câștigi 4 → **-2**
- Licitezi 5, câștigi 0 → **-5**

### Scrie atomică la sfârșitul jocului

La ultima rundă, un singur `writeBatch` face toate actualizările:
- Scoruri cumulative pe masă
- Status masă → 'finished'
- Arhivare joc în `games/{gameId}`
- Statistici utilizatori (totalGames, totalWins, totalScore)
- Statistici membri grup (dacă e joc de grup)

### Gestionarea egalităților în clasament

```typescript
// Scor egal → același rang
if (scores[uid] === scores[playerAbove]) {
  ranks[uid] = ranks[playerAbove]
}
```

### Componenta ScoreBoard

Afișată în timpul jocului cu:
- Licitația fiecărui jucător
- Levate câștigate vs. licitate (✓ nimerești, ✗ ratezi, ⋯ în curs)
- Scorul total cumulativ

### Modalul RoundSummary

Afișat după fiecare rundă înainte de a avansa, cu detalii complete:
licitație, câștigat, delta, total nou.
