import type {
    BattleInputKey,
    BeatdownHitType,
    BossId,
    Raid
} from "../raids/raid.types.js";

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

export type SelectRaidBossPayload = {
    raidId: string;
    telegramUserId: string;
    bossId: BossId;
};

export type StartRaidPayload = {
    raidId: string;
    telegramUserId: string;
};

export type BattleAttackPayload = {
    raidId: string;
    telegramUserId: string;
};

export type BattleInputPayload = {
    raidId: string;
    telegramUserId: string;
    key: BattleInputKey;
};

export type BeatdownHitPayload = {
    raidId: string;
    telegramUserId: string;
    hitType: BeatdownHitType;
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
    "raid:selectBoss": (payload: SelectRaidBossPayload) => void;
    "raid:start": (payload: StartRaidPayload) => void;
    "battle:attack": (payload: BattleAttackPayload) => void;
    "battle:input": (payload: BattleInputPayload) => void;
    "battle:beatdownHit": (payload: BeatdownHitPayload) => void;
};

export type ServerToClientEvents = {
    "raid:state": (payload: RaidStatePayload) => void;
    "socket:error": (payload: SocketErrorPayload) => void;
};