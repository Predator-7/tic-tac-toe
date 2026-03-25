import { useState, useEffect } from 'react';
import { login, connectSocket, socket } from './nakama';
import type { MatchData } from '@heroiclabs/nakama-js';
import './index.css';

interface Player {
    userId: string;
    sessionId: string;
    username: string;
    mark: 'X' | 'O';
}

interface GameState {
    players: Player[];
    board: string[];
    turn: 'X' | 'O';
    winner: 'X' | 'O' | 'Draw' | null;
}

function App() {
    const [connected, setConnected] = useState(false);
    const [matchmaking, setMatchmaking] = useState(false);
    const [matchId, setMatchId] = useState<string | null>(null);
    const [mySessionId, setMySessionId] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [error, setError] = useState('');
    const [nickname, setNickname] = useState(localStorage.getItem('nickname') || '');
    const [entered, setEntered] = useState(false);

    useEffect(() => {
        void (async () => {
            try {
                await login();
                const sock = await connectSocket();
                setConnected(true);

                console.log('[App] Socket listeners ready.');

                sock.onmatchmakermatched = async (matched) => {
                    console.log('[App] Match found!', matched);
                    const match = await sock.joinMatch(matched.match_id, matched.token);
                    console.log('[App] Joined match:', match.match_id, 'Self session:', match.self.session_id);
                    setMatchId(match.match_id);
                    setMySessionId(match.self.session_id);
                    setMatchmaking(false);
                };

                sock.onmatchdata = (matchData: MatchData) => {
                    if (matchData.op_code === 1) {
                        const state = JSON.parse(new TextDecoder().decode(matchData.data));
                        console.log('[App] Received state update:', state);
                        setGameState(state);
                    }
                };
            } catch (err) {
                console.error(err);
                setError('Failed to connect to game server. Is Nakama running?');
            }
        })();
    }, []);

    const findMatch = async () => {
        if (!socket) return;
        try {
            if (!nickname) return;
            localStorage.setItem('nickname', nickname);
            const { updateNickname } = await import('./nakama');
            await updateNickname(nickname);
            
            setMatchmaking(true);
            await socket.addMatchmaker("*", 2, 2, { username: nickname });
        } catch (err) {
            console.error(err);
            setError('Failed to join matchmaking.');
            setMatchmaking(false);
        }
    };

    const makeMove = async (index: number) => {
        if (!socket || !matchId || !gameState) return;
        
        const me = gameState.players.find(p => p.sessionId === mySessionId);
        if (!me || gameState.turn !== me.mark || gameState.board[index] !== '' || gameState.winner) {
            return;
        }

        const payload = JSON.stringify({ position: index });
        await socket.sendMatchState(matchId, 2, payload);
    };

    const leaveMatch = () => {
        if (socket && matchId) {
            socket.leaveMatch(matchId);
        }
        setMatchId(null);
        setGameState(null);
        setMatchmaking(false);
    };

    if (error) {
        return (
            <div className="panel" style={{textAlign: 'center'}}>
                <div style={{color: 'var(--error-color)', marginBottom: 20}}>{error}</div>
                <button className="button" onClick={() => window.location.reload()}>Retry Connection</button>
            </div>
        );
    }

    if (!connected) {
        return (
            <div className="panel" style={{textAlign: 'center'}}>
                <div className="loader"></div>
                <div>Connecting to server...</div>
            </div>
        );
    }

    if (!matchId) {
        return (
            <div style={{textAlign: 'center', maxWidth: 400, margin: '0 auto'}}>
                <h1 style={{fontSize: '3rem', marginBottom: 8}}>TIC TAC TOE</h1>
                <p style={{marginBottom: 32, opacity: 0.7}}>Multiplayer • Server Authoritative • Nakama</p>
                
                <div className="panel">
                    {!entered ? (
                        <>
                            <div style={{marginBottom: 20}}>
                                <label style={{display: 'block', marginBottom: 12, textAlign: 'left', fontWeight: 600}}>Your Nickname</label>
                                <input 
                                    className="input-field"
                                    type="text" 
                                    placeholder="Enter name..." 
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <button 
                                className="button" 
                                onClick={() => nickname.length >= 2 && setEntered(true)}
                                disabled={nickname.length < 2}
                            >
                                Continue
                            </button>
                        </>
                    ) : (
                        <>
                            <div style={{marginBottom: 24}}>
                                <div style={{fontSize: '0.9rem', opacity: 0.6, marginBottom: 4}}>Ready as</div>
                                <div style={{fontSize: '1.2rem', fontWeight: 700}}>{nickname}</div>
                                <button 
                                    style={{background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', cursor: 'pointer', marginTop: 4}}
                                    onClick={() => setEntered(false)}
                                >
                                    Change Name
                                </button>
                            </div>
                            
                            <button 
                                className="button" 
                                onClick={findMatch} 
                                disabled={matchmaking}
                            >
                                {matchmaking ? 'Searching...' : 'Find Match'}
                            </button>
                            
                            {matchmaking && (
                                <div style={{marginTop: 20}}>
                                    <div className="loader" style={{margin: '0 auto 12px'}}></div>
                                    <p className="pulse">Waiting for opponent...</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (!gameState) {
        return (
            <div className="panel" style={{textAlign: 'center'}}>
                <div className="loader"></div>
                <div>Joining match...</div>
            </div>
        );
    }

    const me = gameState.players.find(p => p.sessionId === mySessionId);
    const opponent = gameState.players.find(p => p.sessionId !== mySessionId);
    
    let status = '';
    if (gameState.winner) {
        if (gameState.winner === 'Draw') status = "It's a Draw!";
        else if (me && gameState.winner === me.mark) status = "You Won! 🎉";
        else status = "You Lost! 😢";
    } else if (opponent) {
        if (me && gameState.turn === me.mark) status = "Your Turn";
        else status = "Opponent's Turn";
    } else {
        status = "Opponent Left! You Win!";
    }

    return (
        <div style={{width: '100%'}}>
            <h1 style={{fontSize: '2rem'}}>Match found!</h1>
            <div className="panel">
                <div className="status" style={{
                    color: gameState.winner === (me?.mark) ? 'var(--success-color)' : 
                           gameState.winner === 'Draw' ? 'rgba(255,255,255,0.7)' : 
                           gameState.winner ? 'var(--error-color)' : 'var(--text-color)'
                }}>
                    {status}
                </div>
                
                <div className="board">
                    {gameState.board.map((cell, i) => (
                        <button 
                            key={i} 
                            className={`cell ${cell ? cell.toLowerCase() : ''}`}
                            onClick={() => makeMove(i)}
                            disabled={!!gameState.winner || cell !== '' || (me ? gameState.turn !== me.mark : true)}
                        >
                            {cell}
                        </button>
                    ))}
                </div>

                <div className="players-info">
                    <div>You: {me?.mark} {me && gameState.turn === me.mark ? ' (Turn)' : ''}</div>
                    <div>Opponent: {opponent?.mark || '?'} {opponent && gameState.turn === opponent.mark ? ' (Turn)' : ''}</div>
                </div>
                
                {gameState.winner && (
                    <button className="button" style={{marginTop: 24}} onClick={leaveMatch}>Return to Menu</button>
                )}
            </div>
        </div>
    );
}

export default App;
