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

export function matchInit(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[key: string]: string}) {
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
}

export function matchJoinAttempt(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presence: nkruntime.Presence, metadata: {[key: string]: any}) {
    const s = state as MatchState;
    if (s.players.length >= 2 || s.players.find(p => p.sessionId === presence.sessionId)) {
        return { state: s, accept: false };
    }
    return { state: s, accept: true };
}

export function matchJoin(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    const s = state as MatchState;
    for (const presence of presences) {
        const mark = s.players.length === 0 ? 'X' : 'O';
        s.players.push({ userId: presence.userId, sessionId: presence.sessionId, username: presence.username, mark });
    }
    dispatcher.broadcastMessage(1, JSON.stringify({ board: s.board, turn: s.turn, winner: s.winner, players: s.players }));
    return { state: s };
}

export function matchLeave(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    const s = state as MatchState;
    for (const presence of presences) {
        s.players = s.players.filter(p => p.sessionId !== presence.sessionId);
    }
    if (s.players.length === 0) s.emptyMatch = true;
    else if (s.winner === null) {
        s.winner = s.players[0].mark;
        dispatcher.broadcastMessage(1, JSON.stringify({ board: s.board, turn: s.turn, winner: s.winner, players: s.players }));
    }
    return { state: s };
}

export function matchLoop(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, messages: nkruntime.MatchMessage[]) {
    const s = state as MatchState;
    if (s.emptyMatch) return null;
    for (const message of messages) {
        if (message.opCode === 2 && !s.winner) {
            const player = s.players.find(p => p.sessionId === message.sender.sessionId);
            if (player && s.turn === player.mark) {
                const data = JSON.parse(nk.binaryToString(message.data));
                const pos = data.position;
                if (pos >= 0 && pos < 9 && s.board[pos] === '') {
                    s.board[pos] = player.mark;
                    s.winner = checkWinner(s.board);
                    if (!s.winner) s.turn = s.turn === 'X' ? 'O' : 'X';
                    dispatcher.broadcastMessage(1, JSON.stringify({ board: s.board, turn: s.turn, winner: s.winner, players: s.players }));
                }
            }
        }
    }
    return { state: s };
}

export function matchTerminate(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, grace: number) { return { state }; }
export function matchSignal(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, data: string) { return { state, data: "ok" }; }

export function matchmakerMatched(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, entries: nkruntime.MatchmakerResult[]): string | void {
    return nk.matchCreate('tictactoe', {});
}

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    initializer.registerMatch('tictactoe', {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal
    });
    initializer.registerMatchmakerMatched(matchmakerMatched);
    logger.info('Tic-Tac-Toe module loaded.');
}
