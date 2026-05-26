import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import type { UserProfile } from '../types'

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
    totalGames: d.totalGames,
    totalWins: d.totalWins,
    totalScore: d.totalScore,
  }
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
