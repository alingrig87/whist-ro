import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  runTransaction,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import type { UserProfile } from '../types'
import { CREDITS_NEW_USER, CREDITS_PER_GAME } from '../types'

// ─── Profile Creation ─────────────────────────────────────────────────────────

export async function ensureUserProfile(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName ?? 'Anonim',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      createdAt: serverTimestamp(),
      totalGames: 0,
      totalWins: 0,
      totalScore: 0,
      credits: CREDITS_NEW_USER,
    })
  }
}

// ─── Profile Read ─────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    uid,
    displayName: d.displayName,
    email: d.email,
    photoURL: d.photoURL,
    createdAt: d.createdAt?.toDate() ?? new Date(),
    totalGames: d.totalGames ?? 0,
    totalWins: d.totalWins ?? 0,
    totalScore: d.totalScore ?? 0,
    credits: d.credits ?? 0,
  }
}

// ─── Credits ──────────────────────────────────────────────────────────────────

/**
 * Deducts CREDITS_PER_GAME from each non-bot player atomically.
 * Throws if any player has insufficient credits.
 */
export async function deductGameCredits(playerUids: string[]): Promise<void> {
  const humanUids = playerUids.filter(uid => !uid.startsWith('bot-'))

  await runTransaction(db, async tx => {
    // Read all profiles first
    const snaps = await Promise.all(humanUids.map(uid => tx.get(doc(db, 'users', uid))))

    // Check everyone has enough credits
    for (const snap of snaps) {
      const credits = snap.data()?.credits ?? 0
      if (credits < CREDITS_PER_GAME) {
        throw new Error(`${snap.data()?.displayName ?? snap.id} nu are suficiente credite`)
      }
    }

    // Deduct atomically
    for (const uid of humanUids) {
      tx.update(doc(db, 'users', uid), { credits: increment(-CREDITS_PER_GAME) })
    }
  })
}

export async function getCredits(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.data()?.credits ?? 0
}

// ─── Stats Update (called by scoring.ts) ─────────────────────────────────────

export async function incrementUserStats(
  uid: string,
  scoreGain: number,
  isWin: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    totalGames: increment(1),
    totalScore: increment(scoreGain),
    totalWins: isWin ? increment(1) : increment(0),
  })
}
