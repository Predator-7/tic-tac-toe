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
    for (const [a, b, c] of WINNING_COMBINATIONS) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a] as 'X' | 'O';
        }
    }
    if (board.every(cell => cell !== '')) {
        return 'Draw';
    }
    return null;
}

const matchInit: nkruntime.MatchInitFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[key: string]: string}) {
    logger.debug('Match init');
    const state: MatchState = {
        players: [],
        board: Array(9).fill(''),
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

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presence: nkruntime.Presence, metadata: {[key: string]: any}) {
    const s = state as MatchState;
    if (s.players.length >= 2) {
        return { state: s, accept: false, rejectReason: 'Match full' };
    }
    if (s.players.find(p => p.userId === presence.userId)) {
        return { state: s, accept: false, rejectReason: 'Already joined' };
    }
    return { state: s, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    const s = state as MatchState;
    for (const presence of presences) {
        const mark = s.players.length === 0 ? 'X' : 'O';
        s.players.push({
            userId: presence.userId,
            sessionId: presence.sessionId,
            username: presence.username,
            mark
        });
    }
    
    logger.debug('Match joined. Players: ' + s.players.length);
    
    dispatcher.broadcastMessage(1, JSON.stringify({ board: s.board, turn: s.turn, winner: s.winner, players: s.players }));
    
    return { state: s };
};

const matchLeave: nkruntime.MatchLeaveFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    const s = state as MatchState;
    s.players = s.players.filter(p => !presences.find(pr => pr.userId === p.userId));
    
    if (s.players.length === 0) {
        s.emptyMatch = true;
    } else if (s.winner === null) {
        const remainingPlayer = s.players[0];
        s.winner = remainingPlayer.mark;
        dispatcher.broadcastMessage(1, JSON.stringify({ board: s.board, turn: s.turn, winner: s.winner, players: s.players }));
    }
    
    return { state: s };
};

const matchLoop: nkruntime.MatchLoopFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, messages: nkruntime.MatchMessage[]) {
    const s = state as MatchState;
    
    if (s.emptyMatch) {
         return null;
    }

    for (const message of messages) {
        if (message.opCode === 2) {
            if (s.winner) continue;
            
            const player = s.players.find(p => p.userId === message.sender.userId);
            if (!player) continue;
            
            if (s.turn !== player.mark) continue;
            
            const data = JSON.parse(nk.binaryToString(message.data));
            const pos = data.position;
            
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

const matchTerminate: nkruntime.MatchTerminateFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, graceSeconds: number) {
    return { state };
};

const matchSignal: nkruntime.MatchSignalFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, data: string) {
    return { state, data: "ok" };
};
