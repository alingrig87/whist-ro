# 🃏 Whist RO

Whist românesc multiplayer în timp real — creat cu Vite + React + TypeScript + Firebase.

## Funcționalități

- 🃏 **Joc complet** — 15 runde (8→1→8), reguli complete whist românesc
- 🔐 **Autentificare Google** — login obligatoriu pentru statistici
- ⚡ **Real-time** — sincronizare instantanee prin Firestore
- 🔒 **Mâini private** — nimeni nu vede cărțile altcuiva (security rules)
- 🏆 **Clasament global** — după scor total, victorii, jocuri jucate
- 👥 **Grupuri** — creează cercuri de prieteni cu cod de invitație
- 📊 **Clasament per grup** — statistici separate pe fiecare grup
- 📱 **Responsive** — funcționează pe mobil

## Scoring

| Situație | Puncte |
|----------|--------|
| Nimerești exact bid-ul | +5 + bid |
| Ratezi | -(diferența absolută) |

## Setup rapid

### 1. Instalează dependențele
```bash
npm install
```

### 2. Configurează Firebase
Urmează `docs/03-firebase-setup.md` pas cu pas, apoi creează `.env.local`:

```bash
cp .env.local.example .env.local
# Completează cu valorile din Firebase Console
```

### 3. Rulează în development
```bash
npm run dev
```

### 4. Deploy Firestore rules
```bash
npm install -g firebase-tools
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

### 5. Deploy Vercel
Urmează `docs/15-deploy.md`.

## Structura proiectului

```
docs/          # 15 documente tehnice bilingve (EN+RO) — commit-by-commit
src/
  types/       # TypeScript interfaces pentru toate entitățile
  lib/         # Firebase, logică joc, Firestore CRUD
    firebase.ts
    cards.ts      # Deck, shuffle, dealing, whist rules
    scoring.ts    # Calcul scoruri, finalizare joc
    tables.ts     # CRUD mese + subscripții real-time
    groups.ts     # CRUD grupuri
    leaderboard.ts
    users.ts
  context/
    AuthContext.tsx
  components/
    LoginPage.tsx
    Lobby/        # LobbyPage, CreateTableModal, TableCard
    Game/         # GameRoom, WaitingRoom, GameTable, BiddingPanel,
                  # PlayerHand, TrickArea, ScoreBoard, RoundSummary, GameSummary
    Groups/       # GroupsPage, CreateGroupModal, GroupDetail
    Leaderboard/  # LeaderboardPage
    Profile/      # ProfilePage
  styles/
    index.css     # Tema verde închis + layout general
    game.css      # Masă de joc + cărți + animații
firestore.rules   # Reguli securitate (mâini private!)
firestore.indexes.json
```

## Reguli de joc

- **3-6 jucători** cu un pachet standard de 52 cărți
- **15 runde**: 8→7→6→5→4→3→2→1→2→3→4→5→6→7→8 cărți/jucător
- **Atu**: determinat de carta imediat după împărțeală (null la runda de 1 carte)
- **Licitație**: fiecare anunță câte levate va lua; ultimul nu poate face suma = total
- **Joc**: trebuie să urmezi culoarea cerută; atu bate non-atu; cea mai mare carte câștigă
- **Scor**: nimeri exact → +5 + bid; ratezi → -(|bid - won|)

## Docs

| # | Subiect |
|---|---------|
| [01](docs/01-project-setup.md) | Project Setup |
| [02](docs/02-code-quality.md) | Code Quality |
| [03](docs/03-firebase-setup.md) | Firebase Setup |
| [04](docs/04-google-auth.md) | Google Auth |
| [05](docs/05-data-model.md) | Data Model |
| [06](docs/06-lobby.md) | Lobby |
| [07](docs/07-game-room.md) | Game Room |
| [08](docs/08-card-dealing.md) | Card Dealing |
| [09](docs/09-bidding-phase.md) | Bidding Phase |
| [10](docs/10-playing-phase.md) | Playing Phase |
| [11](docs/11-scoring.md) | Scoring |
| [12](docs/12-groups.md) | Groups |
| [13](docs/13-leaderboard.md) | Leaderboard |
| [14](docs/14-firestore-rules.md) | Firestore Rules |
| [15](docs/15-deploy.md) | Deploy |
