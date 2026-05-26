# Commit 07 — Game Room: Waiting Room + Real-Time Sync

## 🇬🇧 English

### Requirements

- Waiting room shows who has joined, with Ready/Unready toggle
- When all players are ready, the host can click "Start Game"
- Starting the game: deal cards, create first round document
- Real-time subscription keeps all clients in sync

### What Was Implemented

| File | Purpose |
|------|---------|
| `src/components/Game/GameRoom.tsx` | Top-level router: waiting vs playing view |
| `src/components/Game/WaitingRoom.tsx` | Pre-game lobby with player list |
| `src/lib/gameSync.ts` | Firestore subscriptions for game state |

### Game Room State Machine

```
WaitingRoom (status: 'waiting')
    ↓ host clicks "Start" (all ready, ≥3 players)
GameTable (status: 'playing')
    ↓ all rounds complete
GameSummary (status: 'finished')
    ↓ navigate back to lobby
```

`GameRoom.tsx` subscribes to `tables/{tableId}` and switches which component
to render based on `table.status`.

### Starting the Game

```typescript
async function startGame(tableId: string, players: PlayerInfo[]) {
  const playerOrder = shuffleArray(players.map(p => p.uid))
  const scores = Object.fromEntries(playerOrder.map(uid => [uid, 0]))

  // 1. Update table: set playerOrder, initialize scores
  await updateDoc(doc(db, 'tables', tableId), {
    status: 'playing',
    playerOrder,
    scores,
    currentRound: 0,
  })

  // 2. Create round 0 document
  await createRound(tableId, 0, playerOrder)
}
```

`shuffleArray` uses Fisher-Yates algorithm for uniform distribution.
Player order is randomized once at game start and fixed for the entire game.

### `createRound` Function

```typescript
async function createRound(
  tableId: string,
  roundIndex: number,
  playerOrder: string[]
) {
  const cardsPerPlayer = getRoundCards(roundIndex) // [8,7,6,5,4,3,2,1,2,...]
  const dealer = playerOrder[roundIndex % playerOrder.length]
  const deck = shuffleDeck(generateDeck(), tableId + roundIndex)
  const hands = dealCards(deck, playerOrder, cardsPerPlayer)
  const trumpCard = deck[playerOrder.length * cardsPerPlayer] // card after deals
  const trumpSuit = cardsPerPlayer === 1 ? null : trumpCard?.suit ?? null

  // Write round metadata
  await setDoc(doc(db, 'tables', tableId, 'rounds', String(roundIndex)), {
    roundNumber: roundIndex + 1,
    cardsPerPlayer,
    trumpSuit,
    dealer,
    phase: 'bidding',
    bids: Object.fromEntries(playerOrder.map(uid => [uid, -1])),
    tricksWon: Object.fromEntries(playerOrder.map(uid => [uid, 0])),
    currentTrick: [],
    trickLeader: playerOrder[(playerOrder.indexOf(dealer) + 1) % playerOrder.length],
    currentPlayer: playerOrder[(playerOrder.indexOf(dealer) + 1) % playerOrder.length],
  })

  // Write each player's hand (private documents)
  for (const uid of playerOrder) {
    await setDoc(doc(db, 'tables', tableId, 'hands', uid), {
      cards: hands[uid],
    })
  }
}
```

### Deterministic Shuffle (Seed-Based)

Cards are shuffled using a seeded PRNG (Mulberry32). The seed is `tableId + roundIndex`.
All clients can verify the deal is consistent, but since hands are written to Firestore
as private documents, clients only see their own cards via security rules.

```typescript
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed))
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

### Real-Time Subscriptions

```typescript
// Subscribe to table document
onSnapshot(doc(db, 'tables', tableId), ...)

// Subscribe to current round
onSnapshot(doc(db, 'tables', tableId, 'rounds', String(currentRound)), ...)

// Subscribe to my hand
onSnapshot(doc(db, 'tables', tableId, 'hands', myUid), ...)

// Subscribe to players subcollection
onSnapshot(collection(db, 'tables', tableId, 'players'), ...)
```

Four separate subscriptions — each fires only when its specific data changes,
minimizing bandwidth and re-renders.

---

## 🇷🇴 Română

### Cerințe

- Sala de așteptare arată cine s-a alăturat, cu toggle Ready/Unready
- Când toți jucătorii sunt ready, host-ul poate apăsa "Pornește Jocul"
- Pornirea jocului: împarte cărțile, creează primul document de rundă
- Abonament în timp real menține toți clienții sincronizați

### Mașina de stare a sălii de joc

```
WaitingRoom (status: 'waiting')
    ↓ host apasă "Pornește" (toți ready, ≥3 jucători)
GameTable (status: 'playing')
    ↓ toate rundele complete
GameSummary (status: 'finished')
```

### Pornirea jocului

1. Se amestecă random ordinea jucătorilor (Fisher-Yates)
2. Se actualizează tabela: status → 'playing', se setează playerOrder
3. Se creează documentul rundei 0 cu mâinile împărțite

### Shuffle determinist bazat pe seed

Cărțile se amestecă cu un PRNG cu seed. Seed-ul e `tableId + roundIndex`.
Toți clienții pot verifica că împărțeala e corectă, dar prin regulile de securitate
Firestore, fiecare client citește doar propria mână.

### 4 abonamente separate

- Documentul mesei (status, scores)
- Runda curentă (faze, licitații, levate)
- Propria mână de cărți
- Subcoleecția de jucători

Fiecare se declanșează doar când datele lui specifice se schimbă —
minimizând bandwidth și re-render-uri.
