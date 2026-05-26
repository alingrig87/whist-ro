# Commit 01 — Project Setup: Vite + React + TypeScript

## 🇬🇧 English

### Requirements

A modern frontend project for a real-time multiplayer card game:
- Compiles TypeScript + JSX to browser-ready JavaScript
- Fast dev server with HMR
- Optimized production bundle
- SPA routing (React Router)

### What Was Implemented

| File | Purpose |
|------|---------|
| `package.json` | Dependencies + npm scripts |
| `tsconfig.json` | TypeScript strict config |
| `vite.config.ts` | Vite bundler + Firebase chunk splitting |
| `index.html` | SPA entry point |
| `src/main.tsx` | React 18 bootstrap |
| `src/App.tsx` | Root component + router |
| `src/styles/index.css` | Global reset + CSS variables |
| `.gitignore` | Excludes node_modules, dist, .env.local |

### Tech Stack Decisions

#### Why Vite (not CRA or Next.js)
- **CRA** — deprecated, slow cold start (bundles everything before serving)
- **Next.js** — SSR-first; overkill for a real-time game where all logic is client-side + Firestore
- **Vite** — instant dev server (native ESM), \<300ms startup, ideal for SPAs

#### Why React Router (not Next.js routing)
The app has client-side navigation only. Routes are:
```
/           → Lobby (redirect to /login if unauthenticated)
/login      → Google Sign-In page
/table/:id  → Game room (waiting + playing)
/groups     → Groups list
/groups/:id → Group detail + leaderboard
/leaderboard → Global leaderboard
/profile    → User profile + game history
```

#### TypeScript Strict Mode
All strict checks enabled (`strict: true`). Key benefits for a game:
- `null` safety prevents accessing cards of disconnected players
- Exhaustive switch cases catch missing game state transitions
- Interface contracts enforce Firestore document shapes

---

## 🇷🇴 Română

### Cerințe

Proiect frontend modern pentru un joc de cărți multiplayer în timp real:
- Compilează TypeScript + JSX
- Server de dev rapid cu HMR
- Bundle optimizat pentru producție
- Routing SPA cu React Router

### Ce s-a implementat

| Fișier | Scop |
|--------|------|
| `package.json` | Dependențe + comenzi npm |
| `tsconfig.json` | Config TypeScript strict |
| `vite.config.ts` | Bundler Vite + chunk splitting Firebase |
| `index.html` | Punct de intrare SPA |
| `src/main.tsx` | Bootstrap React 18 |
| `src/App.tsx` | Componentă root + router |
| `src/styles/index.css` | Reset global + variabile CSS |
| `.gitignore` | Exclude node_modules, dist, .env.local |

### Decizii tehnice

#### De ce Vite
Vite servește fișierele ca module ES native — serverul de dev pornește în \<300ms
indiferent de dimensiunea proiectului. Perfect pentru SPA-uri unde logica e client-side.

#### Rutele aplicației
```
/           → Lobby (redirect la /login dacă nu ești autentificat)
/login      → Pagina de conectare cu Google
/table/:id  → Sala de joc (așteptare + joc activ)
/groups     → Lista grupurilor tale
/groups/:id → Detaliu grup + clasament
/leaderboard → Clasament global
/profile    → Profilul tău + istoricul jocurilor
```

#### TypeScript Strict
Verificări stricte activate complet. Important pentru un joc:
- Siguranță `null` → nu accesăm cărțile unui jucător deconectat
- Switch-uri exhaustive → nu uităm tranziții de stare (bidding → playing → scoring)
- Contracte de interfețe → documentele Firestore au forma corectă
