import {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal
} from './match';

export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    // Register the Tic-Tac-Toe match handler
    initializer.registerMatch('tictactoe', {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal
    });

    // Register the matchmaking completion logic
    initializer.registerMatchmakerMatched((ctx, logger, nk, entries) => {
        return nk.matchCreate('tictactoe', {});
    });

    logger.info('Tic-Tac-Toe module loaded (Server-Authoritative).');
}
