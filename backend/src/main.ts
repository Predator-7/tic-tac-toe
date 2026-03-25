// Tic-Tac-Toe Server-Authoritative Match Module for Nakama

interface Player {
    userId: string;
    sessionId: string;
    username: string;
    mark: 'X' | 'O';
}

interface MatchState {
    players: Player[];
    board: string[];
    turn: 'X' | 'O';
    winner: 'X' | 'O' | 'Draw' | null;
    emptyMatch: boolean;
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
    logger.debug('Match init');
    var state: MatchState = {
        players: [],
        board: ['', '', '', '', '', '', '', '', ''],
        turn: 'X',
        winner: null,
        emptyMatch: false
    };
    return {
        state: state,
        tickRate: 10,
        label: "tictactoe"
    };
};

var matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presence: nkruntime.Presence, metadata: {[key: string]: any}) {
    var s = state as MatchState;
    if (s.players.length >= 2) {
        return { state: s, accept: false, rejectReason: 'Match full' };
    }
    for (var i = 0; i < s.players.length; i++) {
        if (s.players[i].userId === presence.userId) {
            return { state: s, accept: false, rejectReason: 'Already joined' };
        }
    }
    return { state: s, accept: true };
};

var matchJoin: nkruntime.MatchJoinFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    var s = state as MatchState;
    for (var i = 0; i < presences.length; i++) {
        var mark: 'X' | 'O' = s.players.length === 0 ? 'X' : 'O';
        s.players.push({
            userId: presences[i].userId,
            sessionId: presences[i].sessionId,
            username: presences[i].username,
            mark: mark
        });
    }

    logger.debug('Match joined. Players: ' + s.players.length);

    dispatcher.broadcastMessage(1, JSON.stringify({ board: s.board, turn: s.turn, winner: s.winner, players: s.players }));

    return { state: s };
};

var matchLeave: nkruntime.MatchLeaveFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    var s = state as MatchState;
    var remaining: Player[] = [];
    for (var i = 0; i < s.players.length; i++) {
        var found = false;
        for (var j = 0; j < presences.length; j++) {
            if (s.players[i].userId === presences[j].userId) {
                found = true;
                break;
            }
        }
        if (!found) {
            remaining.push(s.players[i]);
        }
    }
    s.players = remaining;

    if (s.players.length === 0) {
        s.emptyMatch = true;
    } else if (s.winner === null) {
        var remainingPlayer = s.players[0];
        s.winner = remainingPlayer.mark;
        dispatcher.broadcastMessage(1, JSON.stringify({ board: s.board, turn: s.turn, winner: s.winner, players: s.players }));
    }

    return { state: s };
};

var matchLoop: nkruntime.MatchLoopFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, messages: nkruntime.MatchMessage[]) {
    var s = state as MatchState;

    if (s.emptyMatch) {
        return null;
    }

    for (var mi = 0; mi < messages.length; mi++) {
        var message = messages[mi];
        if (message.opCode === 2) {
            if (s.winner) continue;

            var player: Player | null = null;
            for (var pi = 0; pi < s.players.length; pi++) {
                if (s.players[pi].userId === message.sender.userId) {
                    player = s.players[pi];
                    break;
                }
            }
            if (!player) continue;

            if (s.turn !== player.mark) continue;

            var data = JSON.parse(nk.binaryToString(message.data));
            var pos = data.position;

            if (pos >= 0 && pos < 9 && s.board[pos] === '') {
                s.board[pos] = player.mark;
                s.winner = checkWinner(s.board);
                if (!s.winner) {
                    s.turn = s.turn === 'X' ? 'O' : 'X';
                }
                dispatcher.broadcastMessage(1, JSON.stringify({ board: s.board, turn: s.turn, winner: s.winner, players: s.players }));
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

// InitModule MUST be a top-level function for Nakama's goja JS engine
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

    initializer.registerMatchmakerMatched(function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, entries: nkruntime.MatchmakerResult[]) {
        return nk.matchCreate('tictactoe', {});
    });

    logger.info('Tic-Tac-Toe module loaded (Server-Authoritative).');
}
