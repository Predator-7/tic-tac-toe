# LILA Tic-Tac-Toe Multiplayer Game

A production-ready, server-authoritative multiplayer Tic-Tac-Toe game built with a React frontend and a Nakama Server backend. 

## 🚀 Live Demo
- **Frontend**: [Vercel Deployment URL] (Update this if you have it)
- **Backend API**: `https://tic-tac-toe-production-1a73.up.railway.app`

## ✨ Features
- **Server-Authoritative Game Logic**: Game state, validation, and turn management happen entirely on the server using TypeScript running inside the Nakama backend.
- **Matchmaking**: Built-in Nakama matchmaker pairs players dynamically.
- **Responsive UI**: Web UI with dark mode, glowing accents, and elegant animations optimized for mobile devices.
- **Cheat Prevention**: The client can't force wins as the server validates turn order, cell occupancy, and game-over state.
- **Automatic Match Cleanup**: Robust handling for player disconnections.

## 🛠 Tech Stack
- **Frontend**: React (Vite), TypeScript, `@heroiclabs/nakama-js`, Vanilla CSS.
- **Backend**: Nakama Server (Go-based with TypeScript runtime), PostgreSQL.
- **Infrastructure**: Railway (Backend), Vercel (Frontend).

---

## 🏗 Architecture and Design
- **Server-Authoritative Match Handler**: The match state (`board`, `turn`, `winner`, `players`) is managed purely by the server. When the client sends a move, the server validates it against the current internal state and only applies it if correct.
- **Matchmaker**: Uses Nakama's global matchmaker `addMatchmaker("*", 2, 2)` so any two users queuing up are automatically matched.
- **Production Build**: Backend uses Rollup to bundle TypeScript into a single runtime-compatible module for Nakama's Javascript engine.

---

## 💻 Local Development

### Prerequisites
- Node.js (v18+)
- (Optional) Docker for local testing

### Backend
1. `cd backend`
2. `npm install`
3. `npm run build` (bundles TypeScript via Rollup into `build/index.js`)
4. The backend is configured to be Docker-ready for deployment to platforms like Railway.

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:5173` in two browser windows to test matchmaking.

---

## ☁️ Deployment Details
- **Backend**: Deployed on Railway using the provided `railway.toml` and `backend/Dockerfile`. It uses a PostgreSQL database for persisting users and session data.
- **Frontend**: Deployed on Vercel. Configuration is handled via `frontend/vercel.json`, which points to the production Nakama host.

---

## 🧪 How to Test
1. Visit the production frontend.
2. Enter a nickname and click **"Find Match"**.
3. Open another tab/browser and repeat.
4. The Nakama Matchmaker will pair both sessions instantly.
5. The game will automatically transition to the game board once a match is formed.
