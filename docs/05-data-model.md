# Commit 05 — Firestore Data Model

## 🇬🇧 English

### Requirements

Design a Firestore schema that supports:
- Real-time game state sync for 3-6 players
- Private card hands (each player sees only their own)
- Groups with leaderboards
- Game history for profiles

### Complete Schema

```
users/{uid}
  displayName:  string
  email:        string
  photoURL:     string
  createdAt:    Timestamp
  totalGames:   number
  totalWins:    number
  totalScore:   number

tables/{tableId}
  name:         string          — e.g. "Masa lui Alin"
  createdBy:    uid
  createdAt:    Timestamp
  status:       'waiting' | 'playing' | 'finished'
  playerOrder:  uid[]           — seat order, set when game starts
  maxPlayers:   number          — 3..6
  scores:       Record<uid, number>  — cumulative scores
  currentRound: number          — 0-indexed
  totalRounds:  number          — depends on maxPlayers (see below)
  groupId:      string | null   — optional group this game is played in

tables/{tableId}/players/{uid}
  displayName:  string
  photoURL:     string
  ready:        boolean
  joinedAt:     Timestamp

tables/{tableId}/rounds/{roundIndex}
  roundNumber:  number          — 1-indexed (display)
  cardsPerPlayer: number
  trumpSuit:    'S'|'H'|'D'|'C'|null   — null for no-trump rounds
  dealer:       uid
  phase:        'dealing'|'bidding'|'playing'|'scoring'
  bids:         Record<uid, number>     — -1 = not yet bid
  tricksWon:    Record<uid, number>
  currentTrick: TrickCard[]     — cards played in current trick
  trickLeader:  uid             — who leads current trick
  currentPlayer: uid

tables/{tableId}/hands/{uid}
  cards:        Card[]          — PRIVATE: security rule: uid == request.auth.uid

games/{gameId}
  tableId:      string
  groupId:      string | null
  players:      PlayerResult[]  — [{uid, displayName, photoURL, score, rank}]
  winner:       uid
  finishedAt:   Timestamp
  totalRounds:  number

groups/{groupId}
  name:         string
  description:  string
  createdBy:    uid
  createdAt:    Timestamp
  inviteCode:   string          — 6-char alphanumeric, unique
  memberUids:   uid[]           — for quick "is member?" checks

groups/{groupId}/members/{uid}
  displayName:  string
  photoURL:     string
  role:         'admin' | 'member'
  joinedAt:     Timestamp
  gamesPlayed:  number
  wins:         number
  totalScore:   number
```

### Round Structure

For N players, the sequence of `cardsPerPlayer` is:
- **3 players**: 8→7→6→5→4→3→2→1→2→3→4→5→6→7→8 = **15 rounds**
- **4 players**: 8→7→6→5→4→3→2→1→2→3→4→5→6→7→8 = **15 rounds**
- **5 players**: 8→7→6→5→4→3→2→1→2→3→4→5→6→7→8 = **15 rounds**
- **6 players**: 8→7→6→5→4→3→2→1→2→3→4→5→6→7→8 = **15 rounds**

All configurations use the same 15-round structure with max 8 cards.

For 3 players, only 3×8=24 cards used from the 52-card deck — the rest are set aside.

### No-Trump Round

The round with `cardsPerPlayer = 1` has `trumpSuit = null`. This is the most
strategic round — every card is equally powerful, bidding 1 is risky.

### Why Denormalize `displayName` in Multiple Places

Firestore charges per read. If we stored player names only in `users/{uid}`,
displaying a leaderboard of 10 games would require 10 × N extra reads for names.
By denormalizing `displayName` + `photoURL` into each relevant document,
one query returns everything needed to render the UI.

Downside: if a user changes their display name, old records show the old name.
Acceptable trade-off for a game app (name changes are rare).

### `TrickCard` Type

```typescript
interface TrickCard {
  uid: string      // who played it
  card: Card       // the card played
}
```

### `Card` Type

```typescript
interface Card {
  suit: 'S' | 'H' | 'D' | 'C'    // Spades, Hearts, Diamonds, Clubs
  rank: '2'|'3'|...|'10'|'J'|'Q'|'K'|'A'
}
```

### Why `PlayerOrder` Array (not a map)

Turn order in Whist is strictly sequential. An array preserves order — maps in
Firestore/JavaScript don't guarantee key order. `playerOrder[0]` is always
the first seat, making "next player" logic trivial:
```typescript
const nextIdx = (playerOrder.indexOf(currentPlayer) + 1) % playerOrder.length
const nextPlayer = playerOrder[nextIdx]
```

---

## 🇷🇴 Română

### Cerințe

Schema Firestore care suportă:
- Sincronizare în timp real a stării jocului pentru 3-6 jucători
- Mâini de cărți private (fiecare jucător vede doar propriile cărți)
- Grupuri cu clasamente
- Istoricul jocurilor pentru profiluri

### Structura rundelor

Pentru N jucători, secvența `cardsPerPlayer` este:
**8→7→6→5→4→3→2→1→2→3→4→5→6→7→8 = 15 runde** (toate configurațiile)

### Runda fără atu

Runda cu `cardsPerPlayer = 1` are `trumpSuit = null`. Cea mai strategică rundă —
toate cărțile sunt la fel de puternice, a licita 1 este riscant.

### De ce denormalizăm `displayName`

Firestore taxează per read. Dacă am stoca numele doar în `users/{uid}`, afișarea
unui clasament de 10 jocuri ar necesita 10 × N read-uri extra pentru nume.
Denormalizând `displayName` + `photoURL` în fiecare document relevant,
o singură interogare returnează tot ce e necesar pentru UI.

### De ce array `playerOrder` (nu map)

Ordinea turelor în Whist e strict secvențială. Un array păstrează ordinea —
map-urile din Firestore/JavaScript nu garantează ordinea cheilor.
`playerOrder[0]` e mereu primul loc, logica "jucătorul următor" e trivială.

### Mâna privată: `tables/{tableId}/hands/{uid}`

Aceasta e singura colecție cu date private. Regula de securitate Firestore:
```
allow read: if request.auth.uid == uid;
allow write: if false; // scrie doar serverul (sau client-ul dealer cu regule custom)
```
