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
import type { TableMeta, TablePlayer, RoundState, PlayerHand, GameMode, RoundResult } from '../types'
import {
  generateDeck,
  seededShuffle,
  dealCards,
  getTrumpCard,
  getRoundSequence,
  getTotalRounds,
  getBiddingOrder,
} from './cards'
import { isBotUid, BOT_CONFIGS } from './bots'
import { deductGameCredits } from './users'
import { hashPassword } from './crypto'

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
  gameMode: GameMode = 'valley',
  password?: string,
  groupId?: string,
): Promise<string> {
  const ref = doc(collection(db, 'tables'))
  const tableId = ref.id
  const pwHash = password ? await hashPassword(password) : null

  await setDoc(ref, {
    name,
    createdBy: creator.uid,
    createdAt: serverTimestamp(),
    status: 'waiting',
    playerOrder: [],
    maxPlayers,
    scores: {},
    currentRound: 0,
    totalRounds: getTotalRounds(maxPlayers),
    gameMode,
    roundSequence: [],
    consecutiveHits: {},
    consecutiveMisses: {},
    passwordHash: pwHash,
    groupId: groupId ?? null,
  })

  // Add creator as first player
  await setDoc(doc(db, 'tables', tableId, 'players', creator.uid), {
    displayName: creator.displayName,
    photoURL: creator.photoURL,
    ready: false,
    isBot: false,
    joinedAt: serverTimestamp(),
  })

  return tableId
}

export async function joinTable(
  tableId: string,
  player: { uid: string; displayName: string; photoURL: string },
  password?: string,
): Promise<void> {
  const tableSnap = await getDoc(doc(db, 'tables', tableId))
  if (!tableSnap.exists()) throw new Error('Masa nu există')

  const table = tableSnap.data()
  if (table.status !== 'waiting') throw new Error('Jocul a început deja')

  // Password check
  if (table.passwordHash) {
    if (!password) throw new Error('Această masă are parolă')
    const entered = await hashPassword(password)
    if (entered !== table.passwordHash) throw new Error('Parolă incorectă')
  }

  const playersSnap = await getDocs(collection(db, 'tables', tableId, 'players'))
  if (playersSnap.size >= table.maxPlayers) throw new Error('Masa este plină')

  await setDoc(doc(db, 'tables', tableId, 'players', player.uid), {
    displayName: player.displayName,
    photoURL: player.photoURL,
    ready: false,
    isBot: false,
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

// ─── Bot Players ──────────────────────────────────────────────────────────────

/**
 * Adds a bot player to the waiting room.
 * botNumber: 1..5 — determines uid ('bot-1'..'bot-5') and display name.
 */
export async function addBotPlayer(tableId: string, botNumber: number): Promise<void> {
  const uid = `bot-${botNumber}`
  const cfg = BOT_CONFIGS[uid] ?? { name: `Bot ${botNumber}`, photoURL: '' }
  await setDoc(doc(db, 'tables', tableId, 'players', uid), {
    displayName: cfg.name,
    photoURL: cfg.photoURL,
    ready: true,
    isBot: true,
    joinedAt: serverTimestamp(),
  })
}

export async function removeBotPlayer(tableId: string, botNumber: number): Promise<void> {
  await deleteDoc(doc(db, 'tables', tableId, 'players', `bot-${botNumber}`))
}

// ─── Game Start ───────────────────────────────────────────────────────────────

export async function startGame(
  tableId: string,
  players: TablePlayer[],
  gameMode: GameMode,
): Promise<void> {
  // Deduct credits from all human players (throws if insufficient)
  await deductGameCredits(players.map(p => p.uid))

  const playerOrder = fisherYates(players.map(p => p.uid))
  const scores = Object.fromEntries(playerOrder.map(uid => [uid, 0]))
  const consecutiveHits = Object.fromEntries(playerOrder.map(uid => [uid, 0]))
  const consecutiveMisses = Object.fromEntries(playerOrder.map(uid => [uid, 0]))
  const roundSequence = getRoundSequence(gameMode, playerOrder.length)

  await updateDoc(doc(db, 'tables', tableId), {
    status: 'playing',
    playerOrder,
    scores,
    consecutiveHits,
    consecutiveMisses,
    currentRound: 0,
    roundSequence,
    totalRounds: roundSequence.length,
  })

  await createRound(tableId, 0, playerOrder, roundSequence)
}

// ─── Round Creation ───────────────────────────────────────────────────────────

export async function createRound(
  tableId: string,
  roundIndex: number,
  playerOrder: string[],
  roundSequence: number[],
): Promise<void> {
  const cardsPerPlayer = roundSequence[roundIndex]
  const seed = `${tableId}-round-${roundIndex}`
  const deck = seededShuffle(generateDeck(playerOrder.length), seed)

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
    trumpCard: trumpCard ?? null,
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
  playerOrder: string[],
  currentTrickLength: number,
): Promise<void> {
  const card = currentHand.cards.find(c => c.id === cardId)
  if (!card) throw new Error('Cartea nu se află în mână')

  const newCards = currentHand.cards.filter(c => c.id !== cardId)
  const isLastInTrick = currentTrickLength + 1 === playerOrder.length

  const roundUpdate: Record<string, unknown> = {
    currentTrick: arrayUnion({ uid, card }),
  }

  // Advance currentPlayer unless this is the last card in the trick
  // (finalizeTrick will set currentPlayer = winner in that case)
  if (!isLastInTrick) {
    const nextIdx = (playerOrder.indexOf(uid) + 1) % playerOrder.length
    roundUpdate.currentPlayer = playerOrder[nextIdx]
  }

  const batch = writeBatch(db)
  batch.update(doc(db, 'tables', tableId, 'rounds', String(roundIndex)), roundUpdate)
  batch.set(doc(db, 'tables', tableId, 'hands', uid), { cards: newCards })

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

function parseTableMeta(id: string, d: ReturnType<typeof doc> extends never ? never : Record<string, unknown>): TableMeta {
  const data = d as Record<string, unknown>
  return {
    id,
    name: data.name as string,
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    status: data.status as TableMeta['status'],
    playerOrder: (data.playerOrder as string[]) ?? [],
    maxPlayers: data.maxPlayers as number,
    scores: (data.scores as Record<string, number>) ?? {},
    currentRound: (data.currentRound as number) ?? 0,
    totalRounds: (data.totalRounds as number) ?? 15,
    gameMode: (data.gameMode as GameMode) ?? 'mountain',
    roundSequence: (data.roundSequence as number[]) ?? [],
    consecutiveHits: (data.consecutiveHits as Record<string, number>) ?? {},
    consecutiveMisses: (data.consecutiveMisses as Record<string, number>) ?? {},
    passwordHash: (data.passwordHash as string | null) ?? null,
    groupId: (data.groupId as string | null) ?? null,
  }
}

export function subscribeToTable(
  tableId: string,
  onData: (table: TableMeta) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'tables', tableId),
    snap => {
      if (!snap.exists()) return
      onData(parseTableMeta(snap.id, snap.data() as Record<string, unknown>))
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
      const data = d.data()
      players[d.id] = {
        uid: d.id,
        displayName: data.displayName as string,
        photoURL: (data.photoURL as string) ?? '',
        ready: data.ready as boolean,
        joinedAt: (data.joinedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
        isBot: (data.isBot as boolean) ?? isBotUid(d.id),
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
      roundNumber: d.roundNumber as number,
      cardsPerPlayer: d.cardsPerPlayer as number,
      trumpSuit: (d.trumpSuit as RoundState['trumpSuit']) ?? null,
      trumpCard: (d.trumpCard as RoundState['trumpCard']) ?? null,
      dealer: d.dealer as string,
      phase: d.phase as RoundState['phase'],
      bids: (d.bids as Record<string, number>) ?? {},
      tricksWon: (d.tricksWon as Record<string, number>) ?? {},
      currentTrick: (d.currentTrick as RoundState['currentTrick']) ?? [],
      trickLeader: d.trickLeader as string,
      currentPlayer: d.currentPlayer as string,
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
    onData({ cards: (snap.data().cards as PlayerHand['cards']) ?? [] })
  })
}

/**
 * Subscribes to ALL player hands in a table.
 * Only usable by the table creator (Firebase security rules enforce this).
 * Used for bot control: the host needs to see bot hands to play on their behalf.
 */
export function subscribeToAllHands(
  tableId: string,
  playerOrder: string[],
  onData: (hands: Record<string, PlayerHand>) => void,
): Unsubscribe {
  const hands: Record<string, PlayerHand> = {}

  const unsubs = playerOrder.map(uid =>
    subscribeToHand(tableId, uid, hand => {
      hands[uid] = hand
      onData({ ...hands })
    }),
  )

  return () => unsubs.forEach(u => u())
}

// ─── Round History ────────────────────────────────────────────────────────────

export async function saveRoundResult(tableId: string, result: RoundResult): Promise<void> {
  await setDoc(
    doc(db, 'tables', tableId, 'results', String(result.roundIndex)),
    result,
  )
}

export async function getRoundResults(tableId: string): Promise<RoundResult[]> {
  const snap = await getDocs(collection(db, 'tables', tableId, 'results'))
  const results: RoundResult[] = []
  snap.forEach(d => results.push(d.data() as RoundResult))
  return results.sort((a, b) => a.roundIndex - b.roundIndex)
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
    const tables: TableMeta[] = snap.docs.map(d =>
      parseTableMeta(d.id, d.data() as Record<string, unknown>),
    )
    onData(tables)
  })
}
