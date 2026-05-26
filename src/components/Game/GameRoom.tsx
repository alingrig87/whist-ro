import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  subscribeToTable,
  subscribeToPlayers,
  subscribeToRound,
  subscribeToHand,
  joinTable,
} from '../../lib/tables'
import type { TableMeta, TablePlayer, RoundState, PlayerHand } from '../../types'
import WaitingRoom from './WaitingRoom'
import GameTable from './GameTable'
import GameSummary from './GameSummary'

export default function GameRoom() {
  const { tableId } = useParams<{ tableId: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [table, setTable] = useState<TableMeta | null>(null)
  const [players, setPlayers] = useState<Record<string, TablePlayer>>({})
  const [round, setRound] = useState<RoundState | null>(null)
  const [hand, setHand] = useState<PlayerHand | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  // Subscribe to table
  useEffect(() => {
    if (!tableId) return
    const unsub = subscribeToTable(
      tableId,
      setTable,
      () => setLoadError('Nu s-a putut încărca masa'),
    )
    return unsub
  }, [tableId])

  // Subscribe to players
  useEffect(() => {
    if (!tableId) return
    const unsub = subscribeToPlayers(tableId, setPlayers)
    return unsub
  }, [tableId])

  // Subscribe to current round
  useEffect(() => {
    if (!tableId || !table || table.status !== 'playing') return
    const unsub = subscribeToRound(tableId, table.currentRound, setRound)
    return unsub
  }, [tableId, table?.currentRound, table?.status])

  // Subscribe to my hand
  useEffect(() => {
    if (!tableId || !user || table?.status !== 'playing') return
    const unsub = subscribeToHand(tableId, user.uid, setHand)
    return unsub
  }, [tableId, user?.uid, table?.status])

  // Auto-join if not already a player (joined via link)
  useEffect(() => {
    if (!table || !user || !profile) return
    if (table.status !== 'waiting') return
    if (players[user.uid]) return // already joined

    setJoining(true)
    joinTable(tableId!, {
      uid: user.uid,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
    })
      .catch(e => setLoadError(e.message))
      .finally(() => setJoining(false))
  }, [table?.status, user?.uid, Object.keys(players).length])

  // Loading state
  if (!table) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Se încarcă masa...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-error">
        <p>{loadError}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>
          Înapoi la lobby
        </button>
      </div>
    )
  }

  if (joining) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Te alăturăm mesei...</p>
      </div>
    )
  }

  // Route by status
  if (table.status === 'waiting') {
    return <WaitingRoom table={table} players={players} />
  }

  if (table.status === 'finished') {
    return <GameSummary table={table} players={players} />
  }

  // Playing
  if (!round || !hand) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Se pregătesc cărțile...</p>
      </div>
    )
  }

  return <GameTable table={table} round={round} hand={hand} players={players} />
}
