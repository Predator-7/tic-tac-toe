import { Client, Session } from '@heroiclabs/nakama-js';
import type { Socket } from '@heroiclabs/nakama-js';

const host = import.meta.env.VITE_NAKAMA_HOST?.trim() || 'tic-tac-toe-production-1a73.up.railway.app';
const port = import.meta.env.VITE_NAKAMA_PORT?.trim() || '443';
const useSSL = (import.meta.env.VITE_NAKAMA_SSL?.trim() || 'true') === 'true';

export const nakamaClient = new Client('defaultkey', host, port, useSSL);

export let session: Session | null = null;
export let socket: Socket | null = null;

export async function login(username: string) {
    const customId = `tictactoe_user_${username}`;
    try {
        session = await nakamaClient.authenticateCustom(customId, true);
        await nakamaClient.updateAccount(session, {
            display_name: username,
        });
        return session;
    } catch (err) {
        throw err;
    }
}

export async function updateNickname(nickname: string) {
    if (!session) throw new Error("Must login first");
    await nakamaClient.updateAccount(session, {
        display_name: nickname,
    });
}

export async function connectSocket() {
    if (!session) throw new Error("Must login first");
    socket = nakamaClient.createSocket(useSSL, false);
    await socket.connect(session, true);
    return socket;
}

export async function rpc(id: string, payload: any = {}) {
    if (!session) throw new Error("Must login first");
    return await nakamaClient.rpc(session, id, payload);
}
