# Commit 09 — Bidding Phase

## 🇬🇧 English

### Requirements

- Each player announces how many tricks they think they'll win (0 to cardsPerPlayer)
- Bidding is sequential, clockwise from left of the dealer
- **The last player cannot bid a number that makes the sum of all bids equal the total tricks**
  (this guarantees at least one player will fail their bid — the "forbidden bid" rule)
- Phase transitions to 'playing' once all players have bid

### What Was Implemented

| File | Purpose |
|------|---------|
| `src/components/Game/BiddingPanel.tsx` | Bidding UI with forbidden bid indicator |
| `src/lib/gameLogic.ts` | Bidding validation + forbidden bid calculation |

### The Forbidden Bid Rule

In Romanian Whist, the last player to bid cannot make a bid that would bring
the total to exactly equal `cardsPerPlayer` (total tricks available).

```typescript
function getForbiddenBid(
  bids: Record<string, number>,
  playerOrder: string[],
  lastBidder: string,
  cardsPerPlayer: number
): number | null {
  const isLastBidder = playerOrder[playerOrder.length - 1] === lastBidder
  if (!isLastBidder) return null

  const sumSoFar = Object.values(bids)
    .filter(b => b >= 0) // -1 means not yet bid
    .reduce((a, b) => a + b, 0)

  const forbidden = cardsPerPlayer - sumSoFar
  if (forbidden < 0 || forbidden > cardsPerPlayer) return null
  return forbidden
}
```

**Example**: 4 players, 5 cards each. Players A, B, C bid 2, 1, 1 → sum = 4.
Last player D cannot bid 1 (would make total = 5 = cardsPerPlayer).
D can bid 0, 2, 3, 4, or 5.

### Bidding Order

Bidding starts with the player to the left of the dealer:

```typescript
function getBiddingOrder(playerOrder: string[], dealer: string): string[] {
  const dealerIdx = playerOrder.indexOf(dealer)
  const startIdx = (dealerIdx + 1) % playerOrder.length
  return [
    ...playerOrder.slice(startIdx),
    ...playerOrder.slice(0, startIdx),
  ]
}
```

### Submitting a Bid

```typescript
async function submitBid(
  tableId: string,
  roundIndex: number,
  uid: string,
  bid: number
): Promise<void> {
  await updateDoc(
    doc(db, 'tables', tableId, 'rounds', String(roundIndex)),
    {
      [`bids.${uid}`]: bid,
      currentPlayer: getNextBidder(bids, biddingOrder, uid),
    }
  )
}
```

Using Firestore **dot notation** (`bids.${uid}`) for partial updates — we update
only one player's bid without overwriting other players' bids.

### Transition to Playing Phase

When all bids are set (no `-1` remaining):

```typescript
// Check in onSnapshot handler
const allBid = playerOrder.every(uid => round.bids[uid] >= 0)
if (allBid && round.phase === 'bidding') {
  const firstPlayer = getBiddingOrder(playerOrder, dealer)[0]
  await updateDoc(roundRef, {
    phase: 'playing',
    currentPlayer: firstPlayer,
    trickLeader: firstPlayer,
  })
}
```

This check runs on every client — to prevent double-writes, we check
`round.phase === 'bidding'` before updating (only the first client to see
all bids placed will update, subsequent identical writes are no-ops).

### BiddingPanel UI

- Shows current trump suit with suit symbol and color (♠♣ black, ♥♦ red)
- Shows how many cards are in this round
- Buttons 0..cardsPerPlayer — the forbidden bid is disabled and highlighted in red
- "Waiting for [player name]..." when it's not your turn
- Your previous bid shown if you've already bid

---

## 🇷🇴 Română

### Cerințe

- Fiecare jucător anunță câte levate crede că va câștiga (0 la cardsPerPlayer)
- Licitația e secvențială, în sensul acelor de ceasornic, de la stânga distribuitorului
- **Ultimul jucător nu poate licita un număr care face suma totală = numărul de levate**
  (regula licitației interzise — garantează că cel puțin un jucător va rata)
- Faza trece la 'playing' după ce toți jucătorii au licitat

### Regula licitației interzise

La Whist românesc, ultimul jucător care licitează nu poate face o licitație care
ar aduce totalul la exact egal cu `cardsPerPlayer` (totalul levate disponibile).

**Exemplu**: 4 jucători, 5 cărți fiecare. A, B, C licitează 2, 1, 1 → sumă = 4.
Ultimul jucător D nu poate licita 1 (ar face totalul = 5 = cardsPerPlayer).
D poate licita 0, 2, 3, 4 sau 5.

### Notația punct Firestore

Folosim `bids.${uid}` pentru actualizări parțiale — actualizăm licitația
unui singur jucător fără a suprascrie licitațiile celorlalți.

### Tranziția spre faza de joc

Când toți jucătorii au licitat (niciun `-1` rămas), orice client care detectează
acest lucru poate actualiza `phase → 'playing'`. Protecție împotriva dublei scrieri:
verificăm `round.phase === 'bidding'` înainte de update.

### UI-ul panoului de licitație

- Afișează atuul curent cu simbolul și culoarea corespunzătoare (♠♣ negru, ♥♦ roșu)
- Butoane 0..cardsPerPlayer — licitația interzisă e dezactivată și roșie
- "Se așteaptă [numele jucătorului]..." când nu e rândul tău
- Licitația ta anterioară afișată dacă ai licitat deja
