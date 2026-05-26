# Commit 08 — Card Dealing: Deck, Shuffle, Deal

## 🇬🇧 English

### Requirements

- Generate a standard 52-card deck
- Shuffle deterministically using a seed (reproducible, verifiable)
- Deal N cards to each player in order
- Determine trump suit from the next card after dealing

### What Was Implemented

| File | Purpose |
|------|---------|
| `src/lib/cards.ts` | Deck generation, shuffle, deal, card utilities |

### Card Representation

```typescript
type Suit = 'S' | 'H' | 'D' | 'C'  // Spades ♠, Hearts ♥, Diamonds ♦, Clubs ♣
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'

interface Card {
  suit: Suit
  rank: Rank
  id: string  // e.g. 'AS', 'KH', '10D' — unique identifier
}
```

String ID for easy comparison and Firestore storage (no nested objects needed).

### Card Values for Trick Resolution

```typescript
const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}
```

### Generating the Deck

```typescript
function generateDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'D', 'C']
  const ranks: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
  return suits.flatMap(suit =>
    ranks.map(rank => ({ suit, rank, id: `${rank}${suit}` }))
  )
}
```

### Seeded Shuffle: Mulberry32 PRNG

```typescript
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return h
}

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

**Why Mulberry32?** It's a fast, high-quality 32-bit PRNG with only 5 operations
per call. Cryptographic quality is not needed — we just need consistent shuffles
across browsers and Node.js environments.

### Dealing Cards

```typescript
function dealCards(
  deck: Card[],
  playerOrder: string[],
  cardsPerPlayer: number
): Record<string, Card[]> {
  const hands: Record<string, Card[]> = {}
  playerOrder.forEach(uid => (hands[uid] = []))

  // Deal one card at a time to each player (like real dealing)
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (const uid of playerOrder) {
      const card = deck[playerOrder.indexOf(uid) + i * playerOrder.length]
      if (card) hands[uid].push(card)
    }
  }
  return hands
}
```

Cards are dealt in round-robin fashion (1 to each player, repeat) — same as
dealing physically.

### Trump Card Determination

```typescript
function getTrumpSuit(
  deck: Card[],
  playerCount: number,
  cardsPerPlayer: number
): Suit | null {
  if (cardsPerPlayer === 1) return null  // No trump in 1-card round
  const trumpCardIndex = playerCount * cardsPerPlayer
  return deck[trumpCardIndex]?.suit ?? null
}
```

The card immediately after all dealt cards determines trump. If the deck runs out
(e.g., 6 players × 8 cards = 48 of 52 used), the 49th card is trump.

### Round Card Sequence

```typescript
function getRoundCards(roundIndex: number): number {
  // [8,7,6,5,4,3,2,1,2,3,4,5,6,7,8] for indices 0-14
  if (roundIndex < 8) return 8 - roundIndex   // descending: 8,7,6,5,4,3,2,1
  return roundIndex - 6                        // ascending:  2,3,4,5,6,7,8
}
```

Index 7 → `getRoundCards(7) = 1` (the 1-card no-trump round in the middle)

---

## 🇷🇴 Română

### Cerințe

- Generează un pachet standard de 52 cărți
- Amestecă determinist cu un seed (reproductibil, verificabil)
- Împarte N cărți fiecărui jucător în ordine
- Determină atuul din carta imediat după împărțeală

### Reprezentarea cărților

```typescript
interface Card {
  suit: 'S' | 'H' | 'D' | 'C'   // ♠ ♥ ♦ ♣
  rank: '2'|...|'10'|'J'|'Q'|'K'|'A'
  id: string  // ex: 'AS', 'KH', '10D'
}
```

ID string pentru comparare ușoară și stocare Firestore (fără obiecte nested).

### Shuffle determinist: Mulberry32 PRNG

Folosim un PRNG (generator de numere pseudo-aleatoare) cu seed.
**De ce Mulberry32?** E rapid, de calitate înaltă, doar 5 operații per apel.
Nu avem nevoie de calitate criptografică — dorim doar shuffles consistente
între browsere și medii Node.js.

### Împărțeala cărților

Cărțile se împart una câte una fiecărui jucător (round-robin) — exact ca în viața reală.

### Determinarea atuului

Carta imediat după toate cărțile împărțite determină atuul.
Runda cu 1 carte per jucător nu are atu (`trumpSuit = null`).

### Secvența rundelor

```
Indice: 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14
Cărți:  8  7  6  5  4  3  2  1  2  3   4  5  6  7  8
```

Total: 15 runde, runda 7 (cu 1 carte) e fără atu — cea mai strategică.
