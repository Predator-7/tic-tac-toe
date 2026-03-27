import { useState, useEffect, useRef } from 'react';
import { login, connectSocket, rpc } from './nakama';
import type { MatchData } from '@heroiclabs/nakama-js';
import './index.css';

interface Player {
    userId: string;
    sessionId: string;
    username: string;
    nickname: string;
    mark: 'X' | 'O';
}

interface GameState {
    players: Player[];
    board: string[];
    turn: 'X' | 'O';
    winner: 'X' | 'O' | 'Draw' | null;
    timerEnabled: boolean;
    lastMoveTick: number;
}

interface LeaderboardRecord {
    username: string;
    wins: number;
    losses: number;
    streak: number;
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
    const [gameMode, setGameMode] = useState<'classic' | 'timed'>('classic');
    const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const socketRef = useRef<any>(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        const savedNick = localStorage.getItem('nickname');
        if (savedNick && savedNick.length >= 2) {
            handleLogin(savedNick);
        }
    }, []);

    const handleLogin = async (name: string) => {
        try {
            setError('');
            const sess = await login(name);
            const sock = await connectSocket();
            socketRef.current = sock;
            setMySessionId(sess.user_id || null);
            setConnected(true);
            setEntered(true);
            localStorage.setItem('nickname', name);

            fetchLeaderboard();

            sock.onmatchmakermatched = async (matched) => {
                const match = await sock.joinMatch(matched.match_id, matched.token);
                setMatchId(match.match_id);
                setMySessionId(match.self.session_id);
                setMatchmaking(false);
            };

            sock.onmatchdata = (matchData: MatchData) => {
                if (matchData.op_code === 1) {
                    const state = JSON.parse(new TextDecoder().decode(matchData.data));
                    setGameState(state);
                    if (state.timerEnabled) setTimeLeft(30);
                }
            };
        } catch (err) {
            console.error(err);
            setError('Failed to connect to game server. Is Nakama running?');
        }
    };

    const fetchLeaderboard = async () => {
        try {
            const lbData = await rpc('get_leaderboard');
            if (lbData.payload) {
                const parsed = typeof lbData.payload === 'string' ? JSON.parse(lbData.payload) : lbData.payload;
                setLeaderboard(parsed.records || []);
            }
        } catch (e) {
            console.error("[App] Failed to fetch leaderboard", e);
        }
    };

    useEffect(() => {
        if (gameState && gameState.timerEnabled && !gameState.winner && gameState.players.length === 2) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => Math.max(0, prev - 1));
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [gameState]);

    const findMatch = async () => {
        const currentSocket = socketRef.current;
        if (!currentSocket) {
            setError('Game server not connected. Please try logging in again.');
            return;
        }

        try {
            if (!nickname) return;
            localStorage.setItem('nickname', nickname);
            
            setMatchmaking(true);
            setError('');
            
            const mode = gameMode || 'classic';
            const query = `+properties.mode:${mode}`;
            
            await currentSocket.addMatchmaker(query, 2, 2, { mode: mode, nickname: nickname });
        } catch (err: any) {
            console.error('[App] Matchmaking error:', err);
            setError(`Matchmaking failed: ${err.message || 'Unknown error'}`);
            setMatchmaking(false);
        }
    };

    const makeMove = async (index: number) => {
        const currentSocket = socketRef.current;
        if (!currentSocket || !matchId || !gameState) return;
        
        const me = gameState.players.find(p => p.sessionId === mySessionId);
        if (!me || gameState.turn !== me.mark || gameState.board[index] !== '' || gameState.winner) {
            return;
        }

        const payload = JSON.stringify({ position: index });
        await currentSocket.sendMatchState(matchId, 2, payload);
    };

    const leaveMatch = () => {
        const currentSocket = socketRef.current;
        if (currentSocket && matchId) {
            currentSocket.leaveMatch(matchId);
        }
        setMatchId(null);
        setGameState(null);
        setMatchmaking(false);
        fetchLeaderboard();
    };

    if (error) {
        return (
            <div className="panel" style={{textAlign: 'center'}}>
                <div style={{color: 'var(--error-color)', marginBottom: 20}}>{error}</div>
                <button className="button" onClick={() => window.location.reload()}>Retry Connection</button>
            </div>
        );
    }

    if (!entered) {
        return (
            <div style={{textAlign: 'center', maxWidth: 500, margin: '0 auto'}}>
                <h1 style={{fontSize: '3rem', marginBottom: 8}}>TIC TAC TOE</h1>
                <p style={{marginBottom: 32, opacity: 0.7}}>Multiplayer • Server Authoritative • Nakama</p>
                <div className="panel">
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
                    <button className="button" onClick={() => handleLogin(nickname)} disabled={nickname.length < 2}>Continue & Login</button>
                    
                    <button 
                        style={{background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', marginTop: 20, cursor: 'pointer', fontSize: '0.9rem'}}
                        onClick={() => { fetchLeaderboard(); setShowLeaderboard(true); }}
                    >
                        View Global Ranking & Stats
                    </button>
                    {showLeaderboard && (
                        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20}}>
                             <div className="panel" style={{textAlign: 'left', width: '100%', maxWidth: 500}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                                    <h2 style={{margin: 0}}>Global Ranking</h2>
                                    <button onClick={() => setShowLeaderboard(false)} style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem'}}>✕</button>
                                </div>
                                <div style={{maxHeight: 400, overflowY: 'auto'}}>
                                    {leaderboard.length === 0 ? <p style={{opacity: 0.5}}>No records yet.</p> : (
                                        <table style={{width: '100%', borderCollapse: 'collapse'}}>
                                            <thead>
                                                <tr style={{opacity: 0.5, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px'}}>
                                                    <th style={{paddingBottom: 12, textAlign: 'left'}}>Player</th>
                                                    <th style={{paddingBottom: 12, textAlign: 'center'}}>W</th>
                                                    <th style={{paddingBottom: 12, textAlign: 'center'}}>L</th>
                                                    <th style={{paddingBottom: 12, textAlign: 'center'}}>Streak</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {leaderboard.map((r, i) => (
                                                    <tr key={i} style={{borderTop: '1px solid rgba(255,255,255,0.05)'}}>
                                                        <td style={{padding: '14px 0', fontSize: '0.9rem'}}>{r.username}</td>
                                                        <td style={{padding: '14px 0', textAlign: 'center', fontWeight: 700, color: 'var(--success-color)'}}>{r.wins}</td>
                                                        <td style={{padding: '14px 0', textAlign: 'center', opacity: 0.5}}>{r.losses}</td>
                                                        <td style={{padding: '14px 0', textAlign: 'center'}}>{r.streak ? `🔥 ${r.streak}` : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!connected) {
        return (
            <div className="panel" style={{textAlign: 'center'}}>
                <div className="loader" style={{margin: '0 auto 20px'}}></div>
                <div>Logging in as <strong>{nickname}</strong>...</div>
                <button 
                    style={{background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', cursor: 'pointer', marginTop: 20}} 
                    onClick={() => { setEntered(false); setError(''); }}
                >
                    Cancel / Back
                </button>
            </div>
        );
    }

    if (!matchId) {
        return (
            <div style={{textAlign: 'center', maxWidth: 500, margin: '0 auto'}}>
                <h1 style={{fontSize: '3rem', marginBottom: 8}}>TIC TAC TOE</h1>
                <p style={{marginBottom: 32, opacity: 0.7}}>Multiplayer • Server Authoritative • Nakama</p>
                
                {showLeaderboard ? (
                    <div className="panel" style={{textAlign: 'left', width: '100%'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                            <h2 style={{margin: 0}}>Global Ranking</h2>
                            <button onClick={() => setShowLeaderboard(false)} style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem'}}>✕</button>
                        </div>
                        <div style={{maxHeight: 400, overflowY: 'auto'}}>
                            {leaderboard.length === 0 ? <p style={{opacity: 0.5}}>No records yet.</p> : (
                                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                                    <thead>
                                        <tr style={{opacity: 0.5, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px'}}>
                                            <th style={{paddingBottom: 12, textAlign: 'left'}}>Player</th>
                                            <th style={{paddingBottom: 12, textAlign: 'center'}}>W</th>
                                            <th style={{paddingBottom: 12, textAlign: 'center'}}>L</th>
                                            <th style={{paddingBottom: 12, textAlign: 'center'}}>Streak</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((r, i) => (
                                            <tr key={i} style={{borderTop: '1px solid rgba(255,255,255,0.05)'}}>
                                                <td style={{padding: '14px 0', fontSize: '0.9rem'}}>{r.username}</td>
                                                <td style={{padding: '14px 0', textAlign: 'center', fontWeight: 700, color: 'var(--success-color)'}}>{r.wins}</td>
                                                <td style={{padding: '14px 0', textAlign: 'center', opacity: 0.5}}>{r.losses}</td>
                                                <td style={{padding: '14px 0', textAlign: 'center'}}>{r.streak ? `🔥 ${r.streak}` : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="panel">
                        <div style={{marginBottom: 24}}>
                            <div style={{fontSize: '0.9rem', opacity: 0.6, marginBottom: 4}}>Logged in as</div>
                            <div style={{fontSize: '1.2rem', fontWeight: 700}}>{nickname}</div>
                            <button style={{background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', cursor: 'pointer', marginTop: 4}} onClick={() => { setEntered(false); setConnected(false); }}>Switch Account</button>
                        </div>

                        <div style={{marginBottom: 24, display: 'flex', gap: 10}}>
                            <button 
                                style={{flex: 1, background: gameMode === 'classic' ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)', height: 40, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem'}}
                                onClick={() => setGameMode('classic')}
                            >
                                CLASSIC
                            </button>
                            <button 
                                style={{flex: 1, background: gameMode === 'timed' ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)', height: 40, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem'}}
                                onClick={() => setGameMode('timed')}
                            >
                                TIMED (30s)
                            </button>
                        </div>
                        
                        <button className="button" onClick={findMatch} disabled={matchmaking}>{matchmaking ? 'Searching...' : 'Find Match'}</button>
                        
                        <button 
                            style={{background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', marginTop: 20, cursor: 'pointer', fontSize: '0.9rem'}}
                            onClick={() => { fetchLeaderboard(); setShowLeaderboard(true); }}
                        >
                            View Global Ranking & Stats
                        </button>
                        
                        {matchmaking && (
                            <div style={{marginTop: 20}}>
                                <div className="loader" style={{margin: '0 auto 12px'}}></div>
                                <p className="pulse">Searching for {gameMode} match...</p>
                            </div>
                        )}
                    </div>
                )}
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
        else status = "You Lost! \ud83d\ude22";
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
                           gameState.winner ? 'var(--error-color)' : 'var(--text-color)',
                    marginBottom: gameState.timerEnabled && !gameState.winner ? 8 : 24
                }}>
                    {status}
                </div>

                {gameState.timerEnabled && !gameState.winner && opponent && (
                    <div style={{textAlign: 'center', marginBottom: 24}}>
                        <div style={{fontSize: '0.7rem', opacity: 0.5, letterSpacing: '1px'}}>TIME LIMIT</div>
                        <div style={{fontSize: '1.5rem', fontWeight: 800, color: timeLeft < 10 ? 'var(--error-color)' : 'inherit'}}>{timeLeft}s</div>
                    </div>
                )}
                
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
                    <div style={{opacity: me && gameState.turn === me.mark ? 1 : 0.5}}>You ({me?.mark}) {me && gameState.turn === me.mark ? '\u25cf' : ''}</div>
                    <div style={{opacity: opponent && gameState.turn === opponent.mark ? 1 : 0.5}}>{opponent?.mark || '?'} {opponent?.nickname} {opponent && gameState.turn === opponent.mark ? '\u25cf' : ''}</div>
                </div>

                <div style={{marginTop: 20, textAlign: 'center', fontSize: '0.8rem', opacity: 0.4}}>
                    Mode: {gameState.timerEnabled ? 'Timed' : 'Classic'}
                </div>
                
                {gameState.winner && (
                    <button className="button" style={{marginTop: 24}} onClick={leaveMatch}>Return to Menu</button>
                )}
            </div>
        </div>
    );
}

export default App;
