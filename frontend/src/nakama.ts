import { Client, Session } from '@heroiclabs/nakama-js';
import type { Socket } from '@heroiclabs/nakama-js';

const host = import.meta.env.VITE_NAKAMA_HOST?.trim() || 'tic-tac-toe-production-1a73.up.railway.app';
const port = import.meta.env.VITE_NAKAMA_PORT?.trim() || '443';
const useSSL = (import.meta.env.VITE_NAKAMA_SSL?.trim() || 'true') === 'true';

export const nakamaClient = new Client('defaultkey', host, port, useSSL);

export let session: Session | null = null;
export let socket: Socket | null = null;

export async function login(username: string) {
    console.log('[Nakama] Attempting login with username:', username);
    try {
        session = await nakamaClient.authenticateCustom(username, true);
        console.log('[Nakama] Login successful.');
        return session;
    } catch (err) {
        console.error('[Nakama] Login failed:', err);
        throw err;
    }
}

export async function updateNickname(nickname: string) {
    if (!session) throw new Error("Must login first");
    await nakamaClient.updateAccount(session, {
        display_name: nickname,
    });
    console.log('[Nakama] Nickname updated to:', nickname);
}

export async function connectSocket() {
    console.log('[Nakama] Creating socket...');
    if (!session) throw new Error("Must login first");
    socket = nakamaClient.createSocket(useSSL, false);
    
    console.log('[Nakama] Connecting socket...');
    await socket.connect(session, true);
    console.log('[Nakama] Socket connected successfully.');
    return socket;
}

export async function rpc(id: string, payload: any = {}) {
    if (!session) throw new Error("Must login first");
    return await nakamaClient.rpc(session, id, payload);
}
