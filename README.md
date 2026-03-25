# LILA Tic-Tac-Toe Multiplayer Game

A production-ready, server-authoritative multiplayer Tic-Tac-Toe game built with a React frontend and a Nakama Server backend. 

## Features
- **Server-Authoritative Game Logic**: Game state, validation, and turn management happen entirely on the server using TypeScript running inside the Nakama backend.
- **Matchmaking**: Built-in Nakama matchmaker pairs players dynamically.
- **Responsive UI**: Web UI with dark mode, glowing accents, and elegant animations optimized for mobile devices.
- **Prevent Cheating**: The client can't force wins because the server validates turn order, empty cells, and game-over state.

## Tech Stack
- **Frontend**: React (Vite), TypeScript, `@heroiclabs/nakama-js`, Vanilla CSS.
- **Backend**: Nakama Server, Typescript runtime module (`@heroiclabs/nakama-common`), PostgreSQL.

---

## 1. Setup and Installation

### Prerequisites
- Node.js (v16+)
- Docker & Docker Compose (for local Nakama backend)

### Backend (Nakama Server)
1. Go to the `backend` directory:
   ```bash
   cd backend
   npm install
   ```
2. Build the TypeScript match handler module:
   ```bash
   npx rollup -c
   ```
   *(This outputs `build/index.js` which Nakama mounts.)*

3. Run Nakama via Docker Compose from the root directory:
   ```bash
   cd ..
   docker compose up -d
   ```
   *(Nakama will bind to `localhost:7350` for API traffic.)*

### Frontend (React App)
1. Go to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in two different browser windows to test multiplayer.

---

## 2. Architecture and Design Decisions

- **Server-Authoritative Match Handler**: Nakama uses a `Match` handler. The match state (`board`, `turn`, `winner`, `players`) is purely managed by the server. When the client sends an operation (`opCode=2`) requesting to make a move, the server validates it against the current internal state and only applies it if correct. This makes it impossible for a malicious client to arbitrarily change the state or move out of turn.
- **Client Side Prediction / Wait**: Currently, the client simply broadcasts its move and waits for the server response `opCode=1` with the completely updated game board.
- **Matchmaker**: The app uses Nakama's global matchmaker `addMatchmaker("*", 2, 2)` so that any two users queuing up are automatically matched without having to share a match ID manually.
- **Aesthetics First**: A modern glassmorphic and elegant dark theme ensures excellent UX on both mobile and desktop.

---

## 3. Deployment Process Documentation

### Backend Deployment (DigitalOcean / AWS / GCP)
1. Set up a Linux VM with Docker and Docker Compose installed.
2. In the cloud VM, clone your repository.
3. Overwrite `docker-compose.yml` to remove the local volume map and instead copy `backend/build/index.js` into the container using a custom Dockerfile if necessary, or simply sync the directory.
4. Expose ports `7350`, `7351` via your cloud provider's firewall.
5. Setup a domain using an Nginx reverse proxy with Let's Encrypt to provide SSL/TLS offloading for Nakama (port 443 proxying to `7350`). This allows connecting via `wss://`.

### Frontend Deployment (Vercel / Netlify / Render)
1. Ensure the deployed React app points to the production Nakama URL (modify `nakamaClient` init in `src/nakama.ts` to `new Client('defaultkey', 'nakama.yourdomain.com', '443', true)`).
2. Commit your code to GitHub.
3. Import the repository in Vercel. Select `frontend` as the Root Directory. Vercel automatically builds using Vite.

---

## 4. API / Server Configuration Details
The Nakama backend is initialized in `docker-compose.yml`.
- **Database**: PostgreSQL (`postgres:12.2-alpine`), username `postgres`, database `nakama`.
- **Nakama**: 
  - `7350`: RPC API and Websocket Port
  - `7351`: Developer Console (visit `http://localhost:7351` and login with `admin`/`password` to monitor matches, players, logs, etc.)
  - Metrics are exported on port `9100`.

---

## 5. How to Test Multiplayer Functionality
1. Bring up the backend with `docker compose up -d` and the frontend with `npm run dev` in `frontend/`.
2. Open an Incognito Window and a normal Window in Chrome. Navigate to `http://localhost:5173` on both.
3. Click **"Find Match"** on the first window. It will enter the matchmaking queue.
4. Click **"Find Match"** on the second window. The Nakama Matchmaker will pair both sessions.
5. The game will automatically transition to the game board.
6. Play Tic-Tac-Toe! The turns are strictly validated. Try disconnecting or closing one window; the robust backend will mark the disconnected player and end the game if all players leave.
