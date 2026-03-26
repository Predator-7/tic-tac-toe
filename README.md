# LILA Tic-Tac-Toe Multiplayer Game

A production-ready, server-authoritative multiplayer Tic-Tac-Toe game built with a React frontend and a Nakama Server backend. 

## 🚀 Live Demo
- **Backend API**: `https://tic-tac-toe-production-1a73.up.railway.app`

## ✨ Features (Standard)
- **Server-Authoritative Game Logic**: Game state, validation, and turn management happen entirely on the server using TypeScript running inside the Nakama backend.
- **Matchmaking**: Built-in Nakama matchmaker pairs players dynamically.
- **Responsive UI**: Web UI with dark mode, glowing accents, and elegant animations.
- **Cheat Prevention**: The client can't force wins; all moves are server-validated.
- **Automatic Match Cleanup**: Robust handling for player disconnections.

## 🎁 Bonus Features
- **Concurrent Game Support**: Handles multiple simultaneous game sessions with full room isolation.
- **Leaderboard System**: Tracks player wins and displays global rankings via a custom server-authoritative leaderboard (Nakama).
- **Timer-Based Gameplay**: 30-second turn limit with automatic forfeit on timeout, enforced by the server match-loop.
- **Mode Selection**: Integrated matchmaking that supports separate queues for 'Classic' and 'Timed' modes.
- **Real-time UI Indicators**: Visual countdown timers and live player state markers.

## 🛠 Tech Stack
- **Frontend**: React (Vite 6+), TypeScript, `@heroiclabs/nakama-js`, Vanilla CSS.
- **Backend**: Nakama Server (Authoritative Match Handler), PostgreSQL.
- **Infrastructure**: Railway (Backend), Vercel (Frontend).

---

## 🏗 Architecture and Design
- **Server-Authoritative Match Handler**: The match state (`board`, `turn`, `winner`, `players`) is managed purely by the server. When the client sends an operation (`opCode=2`), the server validates it and broadcasts the new state (`opCode=1`).
- **Concurrent Match Isolation**: Every match is treated as a separate instance with its own sequestered state, allowing thousands of simultaneous games.
- **Performance**: The backend runs at 10 ticks/second, ensuring low latency for state updates and timer checks.

---

## 💻 Local Development

### Prerequisites
- Node.js (v18+)
- (Optional) Docker for local testing

### Backend
1. `cd backend`
2. `npm install`
3. `npm run build` (produces bundled `build/index.js` via `tsc --outFile`)
4. Backend is pre-configured for Docker/Railway deployment.

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:5173` in two browser windows to test matchmaking.

---

## 🧪 How to Test
1. Visit the production/local frontend.
2. Enter a nickname and click **"Find Match"**.
3. Open another tab/browser and repeat to pair.
4. Note the **Timer** counting down (30s moves).
5. Upon winning, check the **Leaderboard** from the main menu to see your rank!
