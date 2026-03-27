# LILA Tic-Tac-Toe Multiplayer Game

A production-grade, server-authoritative multiplayer Tic-Tac-Toe game. Built with a React frontend and a Nakama Server backend running custom TypeScript match logic.

## 🚀 Live Links
- **Frontend App**: [https://tic-tac-toe-six-fawn.vercel.app](https://tic-tac-toe-six-fawn.vercel.app)
- **Backend API**: [https://tic-tac-toe-production-1a73.up.railway.app](https://tic-tac-toe-production-1a73.up.railway.app)

---

## 🏗 Architecture and Design Decisions

### Server-Authoritative Logic
The core design philosophy is **security and synchronization**. Unlike traditional P2P games where a client could "force" a win, all game state calculations (board updates, turn validation, win detection, and move timers) occur on the Nakama server.
- **State Management**: The server maintains a strict `MatchState` object for every room. Clients only receive the result of validated moves.
- **Tick Rate**: The match loop runs at 10 ticks/second, providing high responsiveness while minimizing server CPU usage.
- **Validation**: Every move (`opCode 2`) is checked against the current turn and board state before being accepted and broadcasted (`opCode 1`).

### Real-time Infrastructure (Nakama)
Nakama was chosen for its robust out-of-the-box features:
- **WebSockets**: Bi-directional communication for zero-latency gameplay.
- **Matchmaker**: Uses an properties-based query system (`+properties.mode:classic`) to pair players into secluded match instances.
- **Leaderboards**: Native leaderboard support for persistent global rankings and win/loss/streak tracking.

### Tech Stack
- **Frontend**: React (Vite), TypeScript, `@heroiclabs/nakama-js`.
- **Backend**: Nakama TypeScript Runtime (Node.js/Go backend environment).
- **Database**: PostgreSQL (persisting user accounts and leaderboard scores).

---

## 💻 Setup and Installation

### Prerequisites
- **Node.js**: v18 or newer.
- **Docker**: (Optional) For running Nakama locally.

### 1. Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Compile the TypeScript module: `npm run build`
   - This uses `tsc` to bundle the code into `build/index.js` which Nakama loads at startup.
4. For local running: Use the provided `docker-compose.yml` (if available) or point to a remote Nakama instance.

### 2. Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Create a `.env` file (or use defaults):
   ```env
   VITE_NAKAMA_HOST=tic-tac-toe-production-1a73.up.railway.app
   VITE_NAKAMA_PORT=443
   VITE_NAKAMA_SSL=true
   ```
4. Start the dev server: `npm run dev`
5. Open `http://localhost:5173` in your browser.

---

## 🚀 Deployment Process

### Backend (Railway)
The backend is deployed using a Docker-based workflow on Railway:
1. **Dockerfile**: A multi-stage Dockerfile compiles the TypeScript code and then runs the Nakama server image.
2. **PostgreSQL**: A managed PostgreSQL database is linked to Nakama for persistent storage.
3. **Environment**: Nakama is configured via environment variables (DB connection string, server keys).

### Frontend (Vercel)
The frontend is hosted on Vercel with automatic CI/CD:
1. **Build Command**: `npm run build`
2. **Output Directory**: `dist`
3. **Environment Variables**: The Nakama host and SSL settings are configured in the Vercel project settings.

---

## ⚙️ API / Server Configuration Details

### Authentication
The system uses **Custom Authentication** to ensure persistent user sessions:
- **Authentication ID**: `tictactoe_user_{nickname}`
- This allows users to keep their stats across devices by entering the same nickname.

### Leaderboards
Two global leaderboards are initialized in `InitModule`:
1. `tic_tac_toe_wins`: Sorted descending (desc), operator increment (incr). Stores total wins and current win streaks in metadata.
2. `tic_tac_toe_losses`: Sorted descending, operator increment. Stores total losses.

### Custom RPCs
- `get_leaderboard`: A custom server-side RPC that aggregates data from both win and loss leaderboards into a unified "Global Ranking" view for the frontend.

---

## 🧪 How to Test Multiplayer

To verify the multiplayer functionality yourself:
1. **Open Two Tabs**: Open the [Live App](https://tic-tac-toe-six-fawn.vercel.app) in two separate browser tabs or windows.
2. **Login**: 
   - Tab 1: Enter "PlayerA" and login.
   - Tab 2: Enter "PlayerB" and login.
3. **Matchmaking**: 
   - In both tabs, select "CLASSIC" or "TIMED" and click **"Find Match"**.
4. **Gameplay**: 
   - The server will match the two players immediately.
   - Validating turns: Try clicking out of turn to see that the server ignores invalid moves.
   - Timer test: In "Timed" mode, wait 30s as a player; the server will automatically forfeit the game and award the win to the opponent.
5. **Leaderboard**: 
   - Complete the match.
   - Go back to the menu and click **"View Global Ranking"** to see the scores updated in real-time.
