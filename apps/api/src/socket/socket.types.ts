import type { Raid } from "../raids/raid.types.js";

export type JoinRaidRoomPayload = {
    raidId: string;
};

export type JoinPlayerPayload = {
    raidId: string;
    telegramUserId: string;
    displayName: string;
};

export type PlayerReadyPayload = {
    raidId: string;
    telegramUserId: string;
    isReady: boolean;
};

export type StartRaidPayload = {
    raidId: string;
    telegramUserId: string;
};

export type RaidStatePayload = {
    raid: Raid;
    serverTime: number;
};

export type SocketErrorPayload = {
    code: string;
    message: string;
};

export type ClientToServerEvents = {
    "raid:joinRoom": (payload: JoinRaidRoomPayload) => void;
    "player:join": (payload: JoinPlayerPayload) => void;
    "player:ready": (payload: PlayerReadyPayload) => void;
    "raid:start": (payload: StartRaidPayload) => void;
};

export type ServerToClientEvents = {
    "raid:state": (payload: RaidStatePayload) => void;
    "socket:error": (payload: SocketErrorPayload) => void;
};