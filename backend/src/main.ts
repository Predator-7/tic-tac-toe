// Tic-Tac-Toe Server-Authoritative Match Module for Nakama

interface Player {
    userId: string;
    sessionId: string;
    username: string;
    nickname: string;
    mark: 'X' | 'O';
}

interface MatchState {
    players: Player[];
    board: string[];
    turn: 'X' | 'O';
    winner: 'X' | 'O' | 'Draw' | null;
    emptyMatch: boolean;
    lastMoveTick: number; 
    timerEnabled: boolean;
    nicknames: {[key: string]: string};
}

const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function checkWinner(board: string[]): 'X' | 'O' | 'Draw' | null {
    for (const combo of WINNING_COMBINATIONS) {
        const a = combo[0], b = combo[1], c = combo[2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a] as 'X' | 'O';
        }
    }
    let allFilled = true;
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') { allFilled = false; break; }
    }
    if (allFilled) return 'Draw';
    return null;
}

var matchInit: nkruntime.MatchInitFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[key: string]: string}) {
    var timerEnabled = params && params.mode === 'timed';
    var nicks = (params && params.nicknames) ? JSON.parse(params.nicknames) : {};
    
    var state: MatchState = {
        players: [],
        board: ['', '', '', '', '', '', '', '', ''],
        turn: 'X',
        winner: null,
        emptyMatch: false,
        lastMoveTick: 0,
        timerEnabled: timerEnabled,
        nicknames: nicks
    };
    return {
        state: state,
        tickRate: 10,
        label: timerEnabled ? "timed" : "classic"
    };
};

var matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presence: nkruntime.Presence, metadata: {[key: string]: any}) {
    return { state: state, accept: true };
};

var matchJoin: nkruntime.MatchJoinFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    var s = state as MatchState;
    for (var i = 0; i < presences.length; i++) {
        var mark: 'X' | 'O' = s.players.length === 0 ? 'X' : 'O';
        var userId = presences[i].userId;
        s.players.push({
            userId: userId,
            sessionId: presences[i].sessionId,
            username: presences[i].username,
            nickname: s.nicknames[userId] || presences[i].username,
            mark: mark
        });
    }
    if (s.players.length === 2 && s.timerEnabled && s.lastMoveTick === 0) s.lastMoveTick = tick;
    dispatcher.broadcastMessage(1, JSON.stringify(s));
    return { state: s };
};

var matchLeave: nkruntime.MatchLeaveFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    var s = state as MatchState;
    var leavingPlayers = s.players.filter(p => presences.find(pr => pr.userId === p.userId));
    s.players = s.players.filter(p => !presences.find(pr => pr.userId === p.userId));
    
    if (s.players.length === 0) {
        s.emptyMatch = true;
    } else if (s.winner === null) {
        var remainingPlayer = s.players[0];
        s.winner = remainingPlayer.mark;
        
        // Record results
        recordMatchResult(nk, logger, remainingPlayer, leavingPlayers[0] || null, false);
        
        dispatcher.broadcastMessage(1, JSON.stringify(s));
    }
    return { state: s };
};

function recordMatchResult(nk: nkruntime.Nakama, logger: nkruntime.Logger, winner: Player | null, loser: Player | null, isDraw: boolean) {
    try {
        if (isDraw) return; // Optional: could track draws too

        if (winner) {
            // Update Wins
            nk.leaderboardRecordWrite('tic_tac_toe_wins', winner.userId, winner.nickname, 1, 0, {}, 'incr' as any);
            
            // Update Streak: Get current, increment, and store in metadata or separate tracker
            // For simplicity in a single RPC fetch, we'll store streaks in the metadata of the 'wins' record
            var records = nk.leaderboardRecordsList('tic_tac_toe_wins', [winner.userId], 1);
            var currentStreak = 1;
            if (records.ownerRecords && records.ownerRecords.length > 0) {
                var meta = records.ownerRecords[0].metadata;
                if (meta && meta.streak) currentStreak = (meta.streak as number) + 1;
            }
            nk.leaderboardRecordWrite('tic_tac_toe_wins', winner.userId, winner.nickname, 1, 0, { streak: currentStreak }, 'incr' as any);
        }

        if (loser) {
            // Update Losses
            nk.leaderboardRecordWrite('tic_tac_toe_losses', loser.userId, loser.nickname, 1, 0, { streak: 0 }, 'incr' as any);
            // Reset streak in wins record too
            nk.leaderboardRecordWrite('tic_tac_toe_wins', loser.userId, loser.nickname, 0, 0, { streak: 0 }, 'set' as any);
        }
    } catch (e) {
        logger.error('Failed to update match results: ' + e);
    }
}

var matchLoop: nkruntime.MatchLoopFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, messages: nkruntime.MatchMessage[]) {
    var s = state as MatchState;
    if (s.emptyMatch) return null;

    if (s.timerEnabled && !s.winner && s.players.length === 2 && s.lastMoveTick > 0) {
        if (tick - s.lastMoveTick > 300) {
            s.winner = (s.turn === 'X' ? 'O' : 'X');
            var winnerPlayer = s.players.find((p: Player) => p.mark === s.winner);
            var loserPlayer = s.players.find((p: Player) => p.mark !== s.winner);
            recordMatchResult(nk, logger, winnerPlayer || null, loserPlayer || null, false);
            dispatcher.broadcastMessage(1, JSON.stringify(s));
        }
    }

    for (var mi = 0; mi < messages.length; mi++) {
        var message = messages[mi];
        if (message.opCode === 2) {
            if (s.winner) continue;
            var player = s.players.find(p => p.userId === message.sender.userId);
            if (!player || s.turn !== player.mark) continue;

            var data = JSON.parse(nk.binaryToString(message.data));
            var pos = data.position;
            if (pos >= 0 && pos < 9 && s.board[pos] === '') {
                s.board[pos] = player.mark;
                s.winner = checkWinner(s.board);
                
                if (s.winner) {
                    if (s.winner !== 'Draw') {
                        var winnerP = s.players.find(p => p.mark === s.winner);
                        var loserP = s.players.find(p => p.mark !== s.winner);
                        recordMatchResult(nk, logger, winnerP || null, loserP || null, false);
                    }
                } else {
                    s.turn = s.turn === 'X' ? 'O' : 'X';
                    s.lastMoveTick = tick;
                }
                dispatcher.broadcastMessage(1, JSON.stringify(s));
            }
        }
    }
    return { state: s };
};

var matchTerminate: nkruntime.MatchTerminateFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, graceSeconds: number) { 
    return { state: state }; 
};

var matchSignal: nkruntime.MatchSignalFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, data: string) { 
    return { state: state, data: "ok" }; 
};

var getLeaderboard: nkruntime.RpcFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string) {
    try {
        var winRecords = nk.leaderboardRecordsList('tic_tac_toe_wins', null as any, 10);
        var lossRecords = nk.leaderboardRecordsList('tic_tac_toe_losses', null as any, 100);
        
        // Merge data for display
        var combined = (winRecords.records || []).map(r => {
            var losses = 0;
            var lRecord = (lossRecords.records || []).find(lr => lr.ownerId === r.ownerId);
            if (lRecord) losses = lRecord.score;
            
            return {
                username: r.username,
                userId: r.ownerId,
                wins: r.score,
                losses: losses,
                streak: (r.metadata && r.metadata.streak) ? r.metadata.streak : 0
            };
        });

        return JSON.stringify({ records: combined });
    } catch (e: any) {
        return JSON.stringify({ records: [] });
    }
};

var matchmakerMatched: nkruntime.MatchmakerMatchedFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, entries: nkruntime.MatchmakerResult[]) {
    var mode = 'classic';
    var nicks: {[key: string]: string} = {};
    if (entries.length > 0) {
        for (var i = 0; i < entries.length; i++) {
            var userId = entries[i].presence.userId;
            nicks[userId] = entries[i].properties.nickname || entries[i].presence.username;
            if (i === 0) mode = entries[i].properties.mode || 'classic';
        }
    }
    return nk.matchCreate('tictactoe', { 
        mode: mode, 
        nicknames: JSON.stringify(nicks) 
    });
};

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    initializer.registerMatch('tictactoe', {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });

    initializer.registerMatchmakerMatched(matchmakerMatched);
    initializer.registerRpc('get_leaderboard', getLeaderboard);

    try {
        nk.leaderboardCreate('tic_tac_toe_wins', true, 'desc' as any, 'incr' as any, '0 0 * * *', {});
        nk.leaderboardCreate('tic_tac_toe_losses', true, 'desc' as any, 'incr' as any, '0 0 * * *', {});
        logger.info('Leaderboards initialized (Wins & Losses).');
    } catch (e) {
        logger.error('LB Init Failure: ' + e);
    }
}
