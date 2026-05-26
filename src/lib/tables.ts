import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { TableMeta, TablePlayer, RoundState, PlayerHand } from '../types'
import {
  generateDeck,
  seededShuffle,
  dealCards,
  getTrumpCard,
  getRoundCards,
  getBiddingOrder,
  TOTAL_ROUNDS,
} from './cards'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Table CRUD ───────────────────────────────────────────────────────────────

export async function createTable(
  name: string,
  maxPlayers: number,
  creator: { uid: string; displayName: string; photoURL: string },
  groupId?: string,
): Promise<string> {
  const ref = doc(collection(db, 'tables'))
  const tableId = ref.id

  await setDoc(ref, {
    name,
    createdBy: creator.uid,
    createdAt: serverTimestamp(),
    status: 'waiting',
    playerOrder: [],
    maxPlayers,
    scores: {},
    currentRound: 0,
    totalRounds: TOTAL_ROUNDS,
    groupId: groupId ?? null,
  })

  // Add creator as first player
  await setDoc(doc(db, 'tables', tableId, 'players', creator.uid), {
    displayName: creator.displayName,
    photoURL: creator.photoURL,
    ready: false,
    joinedAt: serverTimestamp(),
  })

  return tableId
}

export async function joinTable(
  tableId: string,
  player: { uid: string; displayName: string; photoURL: string },
): Promise<void> {
  const tableSnap = await getDoc(doc(db, 'tables', tableId))
  if (!tableSnap.exists()) throw new Error('Masa nu există')

  const table = tableSnap.data()
  if (table.status !== 'waiting') throw new Error('Jocul a început deja')

  // Count current players
  const playersSnap = await getDocs(collection(db, 'tables', tableId, 'players'))
  if (playersSnap.size >= table.maxPlayers) throw new Error('Masa este plină')

  await setDoc(doc(db, 'tables', tableId, 'players', player.uid), {
    displayName: player.displayName,
    photoURL: player.photoURL,
    ready: false,
    joinedAt: serverTimestamp(),
  })
}

export async function leaveTable(tableId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, 'tables', tableId, 'players', uid))
}

export async function setReady(
  tableId: string,
  uid: string,
  ready: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'tables', tableId, 'players', uid), { ready })
}

export async function deleteTable(tableId: string): Promise<void> {
  await updateDoc(doc(db, 'tables', tableId), { status: 'finished' })
}

// ─── Game Start ───────────────────────────────────────────────────────────────

export async function startGame(
  tableId: string,
  players: TablePlayer[],
): Promise<void> {
  const playerOrder = fisherYates(players.map(p => p.uid))
  const scores = Object.fromEntries(playerOrder.map(uid => [uid, 0]))

  await updateDoc(doc(db, 'tables', tableId), {
    status: 'playing',
    playerOrder,
    scores,
    currentRound: 0,
  })

  await createRound(tableId, 0, playerOrder)
}

// ─── Round Creation ───────────────────────────────────────────────────────────

export async function createRound(
  tableId: string,
  roundIndex: number,
  playerOrder: string[],
): Promise<void> {
  const cardsPerPlayer = getRoundCards(roundIndex)
  const seed = `${tableId}-round-${roundIndex}`
  const deck = seededShuffle(generateDeck(), seed)

  const hands = dealCards(deck, playerOrder, cardsPerPlayer)
  const trumpCard = getTrumpCard(deck, playerOrder.length, cardsPerPlayer)
  const trumpSuit = trumpCard?.suit ?? null

  // Dealer rotates each round
  const dealer = playerOrder[roundIndex % playerOrder.length]
  const biddingOrder = getBiddingOrder(playerOrder, dealer)
  const firstPlayer = biddingOrder[0]

  // Batch: round doc + all hand docs
  const batch = writeBatch(db)

  batch.set(doc(db, 'tables', tableId, 'rounds', String(roundIndex)), {
    roundNumber: roundIndex + 1,
    cardsPerPlayer,
    trumpSuit,
    dealer,
    phase: 'bidding',
    bids: Object.fromEntries(playerOrder.map(uid => [uid, -1])),
    tricksWon: Object.fromEntries(playerOrder.map(uid => [uid, 0])),
    currentTrick: [],
    trickLeader: firstPlayer,
    currentPlayer: firstPlayer,
  })

  for (const uid of playerOrder) {
    batch.set(doc(db, 'tables', tableId, 'hands', uid), {
      cards: hands[uid],
    })
  }

  await batch.commit()
}

// ─── Bidding ──────────────────────────────────────────────────────────────────

export async function submitBid(
  tableId: string,
  roundIndex: number,
  uid: string,
  bid: number,
  nextPlayer: string | null,
): Promise<void> {
  const update: Record<string, unknown> = {
    [`bids.${uid}`]: bid,
  }

  if (nextPlayer !== null) {
    update.currentPlayer = nextPlayer
  } else {
    // All bids are in — transition to playing phase
    // The first player in bidding order leads the first trick
    // (currentPlayer stays as-is; the onSnapshot handler transitions phase)
  }

  await updateDoc(doc(db, 'tables', tableId, 'rounds', String(roundIndex)), update)
}

export async function transitionToPlaying(
  tableId: string,
  roundIndex: number,
  firstPlayer: string,
): Promise<void> {
  await updateDoc(doc(db, 'tables', tableId, 'rounds', String(roundIndex)), {
    phase: 'playing',
    currentPlayer: firstPlayer,
    trickLeader: firstPlayer,
  })
}

// ─── Card Play ────────────────────────────────────────────────────────────────

export async function playCard(
  tableId: string,
  roundIndex: number,
  uid: string,
  cardId: string,
  currentHand: { cards: { id: string }[] },
): Promise<void> {
  const card = currentHand.cards.find(c => c.id === cardId)
  if (!card) throw new Error('Cartea nu se află în mână')

  const newCards = currentHand.cards.filter(c => c.id !== cardId)

  const batch = writeBatch(db)

  batch.update(doc(db, 'tables', tableId, 'rounds', String(roundIndex)), {
    currentTrick: arrayUnion({ uid, card }),
  })

  batch.set(doc(db, 'tables', tableId, 'hands', uid), {
    cards: newCards,
  })

  await batch.commit()
}

export async function finalizeTrick(
  tableId: string,
  roundIndex: number,
  winner: string,
  newTricksWon: Record<string, number>,
  isLastTrick: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'tables', tableId, 'rounds', String(roundIndex)), {
    tricksWon: newTricksWon,
    currentTrick: [],
    trickLeader: winner,
    currentPlayer: winner,
    phase: isLastTrick ? 'scoring' : 'playing',
  })
}

// ─── Real-Time Subscriptions ──────────────────────────────────────────────────

export function subscribeToTable(
  tableId: string,
  onData: (table: TableMeta) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'tables', tableId),
    snap => {
      if (!snap.exists()) return
      const d = snap.data()
      onData({
        id: snap.id,
        name: d.name,
        createdBy: d.createdBy,
        createdAt: d.createdAt?.toDate() ?? new Date(),
        status: d.status,
        playerOrder: d.playerOrder ?? [],
        maxPlayers: d.maxPlayers,
        scores: d.scores ?? {},
        currentRound: d.currentRound ?? 0,
        totalRounds: d.totalRounds ?? TOTAL_ROUNDS,
        groupId: d.groupId ?? null,
      })
    },
    onError,
  )
}

export function subscribeToPlayers(
  tableId: string,
  onData: (players: Record<string, TablePlayer>) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'tables', tableId, 'players'), snap => {
    const players: Record<string, TablePlayer> = {}
    snap.forEach(d => {
      players[d.id] = {
        uid: d.id,
        displayName: d.data().displayName,
        photoURL: d.data().photoURL,
        ready: d.data().ready,
        joinedAt: d.data().joinedAt?.toDate() ?? new Date(),
      }
    })
    onData(players)
  })
}

export function subscribeToRound(
  tableId: string,
  roundIndex: number,
  onData: (round: RoundState) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'tables', tableId, 'rounds', String(roundIndex)), snap => {
    if (!snap.exists()) return
    const d = snap.data()
    onData({
      roundNumber: d.roundNumber,
      cardsPerPlayer: d.cardsPerPlayer,
      trumpSuit: d.trumpSuit ?? null,
      dealer: d.dealer,
      phase: d.phase,
      bids: d.bids ?? {},
      tricksWon: d.tricksWon ?? {},
      currentTrick: d.currentTrick ?? [],
      trickLeader: d.trickLeader,
      currentPlayer: d.currentPlayer,
    })
  })
}

export function subscribeToHand(
  tableId: string,
  uid: string,
  onData: (hand: PlayerHand) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'tables', tableId, 'hands', uid), snap => {
    if (!snap.exists()) return
    onData({ cards: snap.data().cards ?? [] })
  })
}

// ─── Lobby Query ──────────────────────────────────────────────────────────────

export function subscribeToOpenTables(
  onData: (tables: TableMeta[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'tables'),
    where('status', '==', 'waiting'),
    orderBy('createdAt', 'desc'),
    limit(20),
  )

  return onSnapshot(q, snap => {
    const tables: TableMeta[] = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        name: data.name,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        status: data.status,
        playerOrder: data.playerOrder ?? [],
        maxPlayers: data.maxPlayers,
        scores: data.scores ?? {},
        currentRound: data.currentRound ?? 0,
        totalRounds: data.totalRounds ?? TOTAL_ROUNDS,
        groupId: data.groupId ?? null,
      }
    })
    onData(tables)
  })
}
