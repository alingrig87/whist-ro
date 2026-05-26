import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './components/LoginPage'
import LobbyPage from './components/Lobby/LobbyPage'
import GameRoom from './components/Game/GameRoom'
import GroupsPage from './components/Groups/GroupsPage'
import GroupDetail from './components/Groups/GroupDetail'
import LeaderboardPage from './components/Leaderboard/LeaderboardPage'
import ProfilePage from './components/Profile/ProfilePage'
import type { ReactNode } from 'react'

// ─── Protected Route ──────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Se încarcă...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginRedirect />} />

        {/* Protected */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <LobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/table/:tableId"
          element={
            <ProtectedRoute>
              <GameRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <GroupsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:groupId"
          element={
            <ProtectedRoute>
              <GroupDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

// Redirect logged-in users away from /login
function LoginRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading"><div className="spinner" /></div>
  if (user) return <Navigate to="/" replace />
  return <LoginPage />
}
