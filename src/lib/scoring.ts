import {
  doc,
  collection,
  updateDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import { db } from './firebase'
import type { RoundState, TableMeta, TablePlayer, PlayerResult } from '../types'
import { createRound } from './tables'
import { isBotUid } from './bots'

// ─── Score Calculation ────────────────────────────────────────────────────────

/**
 * Standard Romanian Whist scoring:
 * - Hit exactly: +5 + bid (bidding 0 and winning gives +5)
 * - Miss: -(|bid - tricksWon|)
 */
export function calculateRoundScore(bid: number, tricksWon: number): number {
  if (bid === tricksWon) return 5 + bid
  return -Math.abs(bid - tricksWon)
}

// ─── Rankings ─────────────────────────────────────────────────────────────────

export function getRanks(
  scores: Record<string, number>,
  playerOrder: string[],
): Record<string, number> {
  const sorted = [...playerOrder].sort((a, b) => scores[b] - scores[a])
  const ranks: Record<string, number> = {}

  sorted.forEach((uid, i) => {
    if (i > 0 && scores[uid] === scores[sorted[i - 1]]) {
      ranks[uid] = ranks[sorted[i - 1]] // Tie → same rank
    } else {
      ranks[uid] = i + 1
    }
  })

  return ranks
}

// ─── Consecutive Wins Bonus ───────────────────────────────────────────────────

/**
 * Awards +10 bonus points every 5 consecutive exact-bid hits.
 * Only counts rounds where cardsPerPlayer > 1 (1-card rounds are skipped).
 * Streak resets after each bonus is awarded and after any miss.
 *
 * Returns: { newHits, bonusAwarded (set of uids who got the bonus this round) }
 */
export function applyConsecutiveBonus(
  playerOrder: string[],
  bids: Record<string, number>,
  tricksWon: Record<string, number>,
  currentHits: Record<string, number>,
  cardsPerPlayer: number,
): {
  newHits: Record<string, number>
  bonusAwarded: Set<string>
  bonusDeltas: Record<string, number>
} {
  const newHits = { ...currentHits }
  const bonusAwarded = new Set<string>()
  const bonusDeltas: Record<string, number> = {}

  for (const uid of playerOrder) {
    bonusDeltas[uid] = 0

    // 1-card rounds don't affect the streak at all
    if (cardsPerPlayer === 1) continue

    const hit = (bids[uid] ?? 0) === (tricksWon[uid] ?? 0)

    if (hit) {
      newHits[uid] = (newHits[uid] ?? 0) + 1
      if (newHits[uid] >= 5) {
        bonusDeltas[uid] = 10
        bonusAwarded.add(uid)
        newHits[uid] = 0 // Reset streak after bonus
      }
    } else {
      newHits[uid] = 0 // Miss resets streak
    }
  }

  return { newHits, bonusAwarded, bonusDeltas }
}

// ─── Apply Round Scores ───────────────────────────────────────────────────────

export async function applyRoundScores(
  table: TableMeta,
  round: RoundState,
  players: Record<string, TablePlayer>,
): Promise<void> {
  const {
    id: tableId,
    playerOrder,
    scores: currentScores,
    currentRound,
    groupId,
    roundSequence,
    consecutiveHits,
  } = table

  // ── Consecutive bonus ───────────────────────────────────────────────────────
  const { newHits, bonusDeltas } = applyConsecutiveBonus(
    playerOrder,
    round.bids,
    round.tricksWon,
    consecutiveHits,
    round.cardsPerPlayer,
  )

  // ── Score deltas ────────────────────────────────────────────────────────────
  const deltas: Record<string, number> = {}
  for (const uid of playerOrder) {
    deltas[uid] =
      calculateRoundScore(round.bids[uid] ?? 0, round.tricksWon[uid] ?? 0) +
      (bonusDeltas[uid] ?? 0)
  }

  // ── New cumulative scores ───────────────────────────────────────────────────
  const newScores: Record<string, number> = {}
  for (const uid of playerOrder) {
    newScores[uid] = (currentScores[uid] ?? 0) + deltas[uid]
  }

  const isLastRound = currentRound >= roundSequence.length - 1
  const batch = writeBatch(db)

  if (isLastRound) {
    // ── Final round: finalize game ────────────────────────────────────────────

    const ranks = getRanks(newScores, playerOrder)
    const winner = playerOrder.reduce((a, b) => (newScores[a] > newScores[b] ? a : b))

    batch.update(doc(db, 'tables', tableId), {
      scores: newScores,
      consecutiveHits: newHits,
      status: 'finished',
    })

    // Archive game (exclude bots from the record if desired — here we include them)
    const gameRef = doc(collection(db, 'games'))
    const gamePlayers: PlayerResult[] = playerOrder.map(uid => ({
      uid,
      displayName: players[uid]?.displayName ?? uid,
      photoURL: players[uid]?.photoURL ?? '',
      score: newScores[uid],
      rank: ranks[uid],
    }))

    batch.set(gameRef, {
      tableId,
      groupId: groupId ?? null,
      players: gamePlayers,
      winner,
      finishedAt: serverTimestamp(),
      totalRounds: roundSequence.length,
    })

    // Update user global stats — skip bots
    for (const uid of playerOrder) {
      if (isBotUid(uid)) continue
      batch.update(doc(db, 'users', uid), {
        totalGames: increment(1),
        totalScore: increment(deltas[uid]),
        totalWins: uid === winner ? increment(1) : increment(0),
      })
    }

    // Update group member stats — skip bots
    if (groupId) {
      for (const uid of playerOrder) {
        if (isBotUid(uid)) continue
        batch.update(doc(db, 'groups', groupId, 'members', uid), {
          gamesPlayed: increment(1),
          totalScore: increment(newScores[uid]),
          wins: uid === winner ? increment(1) : increment(0),
        })
      }
    }

    await batch.commit()
  } else {
    // ── Not last round: update scores + create next round ─────────────────────

    batch.update(doc(db, 'tables', tableId), {
      scores: newScores,
      consecutiveHits: newHits,
      currentRound: currentRound + 1,
    })

    await batch.commit()
    await createRound(tableId, currentRound + 1, playerOrder, roundSequence)
  }
}
