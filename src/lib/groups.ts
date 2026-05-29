import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Group, GroupMember, UserProfile, GameRecord } from '../types'

export const MAX_GROUPS_PER_USER = 3

// ─── Invite Code ──────────────────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No I, O, 0, 1

function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

async function inviteCodeExists(code: string): Promise<boolean> {
  const q = query(collection(db, 'groups'), where('inviteCode', '==', code), limit(1))
  const snap = await getDocs(q)
  return !snap.empty
}

// ─── Limit check ─────────────────────────────────────────────────────────────

async function checkGroupLimit(uid: string): Promise<void> {
  const q = query(
    collection(db, 'groups'),
    where('memberUids', 'array-contains', uid),
  )
  const snap = await getDocs(q)
  if (snap.size >= MAX_GROUPS_PER_USER) {
    throw new Error(
      `Ești deja în ${MAX_GROUPS_PER_USER} grupuri (limita maximă). Ieși dintr-un grup înainte să creezi/intri în altul.`,
    )
  }
}

// ─── Create Group ─────────────────────────────────────────────────────────────

export async function createGroup(
  name: string,
  description: string,
  creator: UserProfile,
): Promise<string> {
  await checkGroupLimit(creator.uid)
  let inviteCode = generateInviteCode()
  while (await inviteCodeExists(inviteCode)) {
    inviteCode = generateInviteCode()
  }

  const ref = doc(collection(db, 'groups'))
  const groupId = ref.id

  const batch = writeBatch(db)

  batch.set(ref, {
    name,
    description,
    createdBy: creator.uid,
    createdAt: serverTimestamp(),
    inviteCode,
    memberUids: [creator.uid],
  })

  batch.set(doc(db, 'groups', groupId, 'members', creator.uid), {
    displayName: creator.displayName,
    photoURL: creator.photoURL,
    role: 'admin',
    joinedAt: serverTimestamp(),
    gamesPlayed: 0,
    wins: 0,
    totalScore: 0,
  })

  await batch.commit()
  return groupId
}

// ─── Join via Code ────────────────────────────────────────────────────────────

export async function joinGroupByCode(
  code: string,
  user: UserProfile,
): Promise<string> {
  await checkGroupLimit(user.uid)
  const q = query(
    collection(db, 'groups'),
    where('inviteCode', '==', code.toUpperCase()),
    limit(1),
  )
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('Cod de invitație invalid')

  const groupDoc = snap.docs[0]
  const groupId = groupDoc.id
  const groupData = groupDoc.data()

  if (groupData.memberUids.includes(user.uid)) {
    throw new Error('Ești deja în acest grup')
  }

  const batch = writeBatch(db)

  batch.update(doc(db, 'groups', groupId), {
    memberUids: arrayUnion(user.uid),
  })

  batch.set(doc(db, 'groups', groupId, 'members', user.uid), {
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: 'member',
    joinedAt: serverTimestamp(),
    gamesPlayed: 0,
    wins: 0,
    totalScore: 0,
  })

  await batch.commit()
  return groupId
}

// ─── Leave Group ──────────────────────────────────────────────────────────────

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'groups', groupId), { memberUids: arrayRemove(uid) })
  batch.delete(doc(db, 'groups', groupId, 'members', uid))
  await batch.commit()
}

// ─── Delete Group (admin only) ────────────────────────────────────────────────

export async function deleteGroup(groupId: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId))
}

// ─── Refresh Invite Code ──────────────────────────────────────────────────────

export async function refreshInviteCode(groupId: string): Promise<string> {
  let code = generateInviteCode()
  while (await inviteCodeExists(code)) code = generateInviteCode()
  await updateDoc(doc(db, 'groups', groupId), { inviteCode: code })
  return code
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function subscribeToMyGroups(
  uid: string,
  onData: (groups: Group[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'groups'),
    where('memberUids', 'array-contains', uid),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, snap => {
    const groups: Group[] = snap.docs.map(d => ({
      id: d.id,
      name: d.data().name,
      description: d.data().description,
      createdBy: d.data().createdBy,
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      inviteCode: d.data().inviteCode,
      memberUids: d.data().memberUids ?? [],
    }))
    onData(groups)
  })
}

// ─── Group Game History ───────────────────────────────────────────────────────

export async function getGroupGames(groupId: string): Promise<GameRecord[]> {
  const q = query(
    collection(db, 'games'),
    where('groupId', '==', groupId),
    orderBy('finishedAt', 'desc'),
    limit(50),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      tableId: data.tableId,
      groupId: data.groupId,
      players: data.players ?? [],
      winner: data.winner,
      finishedAt: data.finishedAt?.toDate() ?? new Date(),
      totalRounds: data.totalRounds ?? 0,
    } as GameRecord
  })
}

export function subscribeToGroupMembers(
  groupId: string,
  onData: (members: GroupMember[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'groups', groupId, 'members'),
    orderBy('totalScore', 'desc'),
  )
  return onSnapshot(q, snap => {
    const members: GroupMember[] = snap.docs.map(d => ({
      uid: d.id,
      displayName: d.data().displayName,
      photoURL: d.data().photoURL,
      role: d.data().role,
      joinedAt: d.data().joinedAt?.toDate() ?? new Date(),
      gamesPlayed: d.data().gamesPlayed ?? 0,
      wins: d.data().wins ?? 0,
      totalScore: d.data().totalScore ?? 0,
    }))
    onData(members)
  })
}
