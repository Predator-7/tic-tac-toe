// Tic-Tac-Toe Server-Authoritative Match Module for Nakama

interface Player {
    userId: string;
    sessionId: string;
    username: string; // Internal username
    nickname: string; // Friendly nickname
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
    nicknames: {[key: string]: string}; // Key: userId, Value: nickname
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
    s.players = s.players.filter(p => !presences.find(pr => pr.userId === p.userId));
    if (s.players.length === 0) s.emptyMatch = true;
    else if (s.winner === null) {
        var remainingPlayer = s.players[0];
        s.winner = remainingPlayer.mark;
        recordWin(nk, logger, remainingPlayer.userId, remainingPlayer.nickname);
        dispatcher.broadcastMessage(1, JSON.stringify(s));
    }
    return { state: s };
};

function recordWin(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, nickname: string) {
    try {
        nk.leaderboardRecordWrite('tic_tac_toe_wins', userId, nickname, 1, 0, {}, 'incr' as any);
        logger.info('Leaderboard record save for user: ' + nickname);
    } catch (e) {
        logger.error('Failed to update leaderboard: ' + e);
    }
}

var matchLoop: nkruntime.MatchLoopFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, messages: nkruntime.MatchMessage[]) {
    var s = state as MatchState;
    if (s.emptyMatch) return null;

    if (s.timerEnabled && !s.winner && s.players.length === 2 && s.lastMoveTick > 0) {
        if (tick - s.lastMoveTick > 300) {
            s.winner = (s.turn === 'X' ? 'O' : 'X');
            var winnerPlayer = s.players.find((p: Player) => p.mark === s.winner);
            if (winnerPlayer) recordWin(nk, logger, winnerPlayer.userId, winnerPlayer.nickname);
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
                if (s.winner && s.winner !== 'Draw') recordWin(nk, logger, player.userId, player.nickname);
                if (!s.winner) { s.turn = s.turn === 'X' ? 'O' : 'X'; s.lastMoveTick = tick; }
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
        var records = nk.leaderboardRecordsList('tic_tac_toe_wins', null as any, 10);
        return JSON.stringify(records);
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
        logger.info('Leaderboard initialized.');
    } catch (e) {
        logger.error('LB Init Failure: ' + e);
    }
}
