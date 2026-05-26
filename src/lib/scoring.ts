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

// ─── Apply Round Scores ───────────────────────────────────────────────────────

export async function applyRoundScores(
  table: TableMeta,
  round: RoundState,
  players: Record<string, TablePlayer>,
): Promise<void> {
  const { id: tableId, playerOrder, scores: currentScores, currentRound, groupId } = table

  // Calculate score deltas
  const deltas: Record<string, number> = {}
  for (const uid of playerOrder) {
    deltas[uid] = calculateRoundScore(round.bids[uid] ?? 0, round.tricksWon[uid] ?? 0)
  }

  // New cumulative scores
  const newScores: Record<string, number> = {}
  for (const uid of playerOrder) {
    newScores[uid] = (currentScores[uid] ?? 0) + deltas[uid]
  }

  const isLastRound = currentRound === 14 // 15 rounds (0-14)
  const batch = writeBatch(db)

  if (isLastRound) {
    // ── Final round: finalize game ────────────────────────────────────────────

    const ranks = getRanks(newScores, playerOrder)
    const winner = playerOrder.reduce((a, b) => (newScores[a] > newScores[b] ? a : b))

    // Finalize table
    batch.update(doc(db, 'tables', tableId), {
      scores: newScores,
      status: 'finished',
    })

    // Archive game
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
      totalRounds: 15,
    })

    // Update user global stats
    for (const uid of playerOrder) {
      batch.update(doc(db, 'users', uid), {
        totalGames: increment(1),
        totalScore: increment(deltas[uid]),
        totalWins: uid === winner ? increment(1) : increment(0),
      })
    }

    // Update group member stats if this was a group game
    if (groupId) {
      for (const uid of playerOrder) {
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
      currentRound: currentRound + 1,
    })

    await batch.commit()
    await createRound(tableId, currentRound + 1, playerOrder)
  }
}
