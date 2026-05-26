import {
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { UserProfile, GameRecord } from '../types'

// ─── Global Leaderboard ───────────────────────────────────────────────────────

export function subscribeToTopPlayers(
  onData: (users: UserProfile[]) => void,
  sortBy: 'totalScore' | 'totalWins' | 'totalGames' = 'totalScore',
): Unsubscribe {
  const q = query(
    collection(db, 'users'),
    orderBy(sortBy, 'desc'),
    limit(50),
  )
  return onSnapshot(q, snap => {
    const users: UserProfile[] = snap.docs.map(d => ({
      uid: d.id,
      displayName: d.data().displayName,
      email: d.data().email,
      photoURL: d.data().photoURL,
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      totalGames: d.data().totalGames ?? 0,
      totalWins: d.data().totalWins ?? 0,
      totalScore: d.data().totalScore ?? 0,
    }))
    onData(users)
  })
}

// ─── Recent Games ─────────────────────────────────────────────────────────────

export async function getRecentGames(
  groupId?: string,
  count = 10,
): Promise<GameRecord[]> {
  let q
  if (groupId) {
    q = query(
      collection(db, 'games'),
      where('groupId', '==', groupId),
      orderBy('finishedAt', 'desc'),
      limit(count),
    )
  } else {
    q = query(
      collection(db, 'games'),
      orderBy('finishedAt', 'desc'),
      limit(count),
    )
  }

  const snap = await getDocs(q)
  return snap.docs.map(d => ({
    id: d.id,
    tableId: d.data().tableId,
    groupId: d.data().groupId ?? null,
    players: d.data().players ?? [],
    winner: d.data().winner,
    finishedAt: d.data().finishedAt?.toDate() ?? new Date(),
    totalRounds: d.data().totalRounds,
  }))
}

// ─── Win Rate Helper ──────────────────────────────────────────────────────────

export function winRate(totalWins: number, totalGames: number): number {
  if (totalGames === 0) return 0
  return Math.round((totalWins / totalGames) * 100)
}
