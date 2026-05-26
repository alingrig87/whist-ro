# Commit 10 — Playing Phase: Tricks & Card Rules

## 🇬🇧 English

### Requirements

- Current player selects a card from their hand
- Must follow the led suit if possible
- Trump cards beat all non-trump cards
- Highest card of the led suit wins, unless a trump was played
- After all players play, highest card wins the trick
- Trick winner leads the next trick

### What Was Implemented

| File | Purpose |
|------|---------|
| `src/components/Game/GameTable.tsx` | Main game layout: table, players, center |
| `src/components/Game/PlayerHand.tsx` | Clickable hand of cards at bottom |
| `src/components/Game/CardComponent.tsx` | Individual card with suit/rank rendering |
| `src/components/Game/TrickArea.tsx` | Center area showing current trick |
| `src/lib/gameLogic.ts` | Card legality, trick resolution |

### Card Legality: Must Follow Suit

```typescript
function getLegalCards(hand: Card[], ledSuit: Suit | null): Card[] {
  if (!ledSuit) return hand  // first card of trick — any card is legal
  const suitCards = hand.filter(c => c.suit === ledSuit)
  return suitCards.length > 0 ? suitCards : hand  // must follow if possible
}
```

`ledSuit` is `null` when the current player is leading (no card has been played yet).

### Playing a Card

```typescript
async function playCard(
  tableId: string,
  roundIndex: number,
  uid: string,
  card: Card,
  currentHand: Card[]
): Promise<void> {
  const newHand = currentHand.filter(c => c.id !== card.id)

  // Add card to current trick + remove from hand (two writes, batched)
  const batch = writeBatch(db)
  batch.update(
    doc(db, 'tables', tableId, 'rounds', String(roundIndex)),
    { currentTrick: arrayUnion({ uid, card }) }
  )
  batch.set(
    doc(db, 'tables', tableId, 'hands', uid),
    { cards: newHand }
  )
  await batch.commit()
}
```

**Batched write** ensures hand update and trick update are atomic — no state
where a card is played but still in the hand, or removed from hand but not played.

### Trick Resolution

Called when `currentTrick.length === playerOrder.length`:

```typescript
function resolveTrick(
  trick: TrickCard[],
  trumpSuit: Suit | null
): string {
  const ledSuit = trick[0].card.suit
  let winner = trick[0]

  for (const played of trick.slice(1)) {
    if (beats(played.card, winner.card, ledSuit, trumpSuit)) {
      winner = played
    }
  }
  return winner.uid
}

function beats(
  challenger: Card,
  current: Card,
  ledSuit: Suit,
  trumpSuit: Suit | null
): boolean {
  const challIsTrump = trumpSuit && challenger.suit === trumpSuit
  const currIsTrump  = trumpSuit && current.suit === trumpSuit

  if (challIsTrump && !currIsTrump) return true   // trump beats non-trump
  if (!challIsTrump && currIsTrump) return false  // non-trump loses to trump
  if (challenger.suit !== current.suit) return false // off-suit, no trump → loses
  return RANK_VALUES[challenger.rank] > RANK_VALUES[current.rank]
}
```

### After Trick Resolution

```typescript
async function finalizeTrick(
  tableId: string,
  roundIndex: number,
  round: RoundState,
  playerOrder: string[]
): Promise<void> {
  const winner = resolveTrick(round.currentTrick, round.trumpSuit)
  const newTricksWon = { ...round.tricksWon, [winner]: round.tricksWon[winner] + 1 }
  const isLastTrick = Object.values(newTricksWon).reduce((a, b) => a + b, 0) === round.cardsPerPlayer

  await updateDoc(roundRef, {
    tricksWon: newTricksWon,
    currentTrick: [],
    trickLeader: winner,
    currentPlayer: winner,
    phase: isLastTrick ? 'scoring' : 'playing',
  })
}
```

### Who Resolves the Trick?

Every client runs `resolveTrick` in their `onSnapshot` handler when they see
`currentTrick.length === playerOrder.length`. The client whose turn it is
to play next (the trick leader) performs the Firestore write.

To avoid race conditions (multiple clients writing simultaneously), we add a
`lastTrickResolvedBy` field that's set to the resolving client's UID — subsequent
clients skip the write if it's already set.

### Visual Layout

```
┌──────────────────────────────────────────────┐
│  [Player 3 — top]    [Player 4 — top right]  │
│                                              │
│ [Player 2          CENTER TRICK        Player 5] │
│ — left]         ♥K  ♠A  ♦7  ♣Q          [— right]│
│                  (bid/tricks tracker)        │
│                                              │
│         [Current Player — bottom]            │
│      [Your hand — fan of face-up cards]      │
└──────────────────────────────────────────────┘
```

Other players' cards are shown face-down with card count indicator.

---

## 🇷🇴 Română

### Cerințe

- Jucătorul curent selectează o carte din mână
- Trebuie să urmeze culoarea cerută dacă are
- Cărțile de atu bat toate cărțile non-atu
- Câștigătorul levate conduce următoarea

### Legalitatea cărților: must follow suit

```typescript
function getLegalCards(hand: Card[], ledSuit: Suit | null): Card[] {
  if (!ledSuit) return hand  // prima carte a levate — orice carte e legală
  const suitCards = hand.filter(c => c.suit === ledSuit)
  return suitCards.length > 0 ? suitCards : hand  // trebuie să urmezi dacă poți
}
```

### Scriere batch

Actualizarea mâinii și a levate curente se face atomic printr-un `writeBatch` —
nu poate exista o stare în care o carte e jucată dar mai e și în mână.

### Rezolvarea levate

Când toți jucătorii au jucat o carte:
1. Găsim câștigătorul (atu bate non-atu, cea mai mare carte din culoarea cerută câștigă)
2. Incrementăm `tricksWon[winner]`
3. Câștigătorul conduce următoarea levate
4. Dacă e ultima levată → `phase = 'scoring'`

### Cine rezolvă levata?

Toți clienții rulează logica de rezolvare în handler-ul `onSnapshot`. Câștigătorul
levate (care conduce următoarea) efectuează write-ul Firestore. Câmpul
`lastTrickResolvedBy` previne write-uri duble.

### Layout vizual

```
      [Jucător 3 — sus]  [Jucător 4 — sus dreapta]
      
[Jucător 2      LEVATA CURENTĂ        Jucător 5]
[— stânga]   ♥K  ♠A  ♦7  ♣Q          [— dreapta]
                (tracker licitații/levate)

        [Jucătorul curent — jos]
      [Mâna ta — evantai de cărți]
```
