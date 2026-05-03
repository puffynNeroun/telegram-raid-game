export type RaidStatus = "lobby" | "cancelled" | "battle" | "finished";

export type BattleStatus = "active" | "finished";
export type BattleOutcome = "win" | "lose" | null;
export type BossPhase = "idle" | "hurt" | "rage" | "defeated";

export type RaidPlayer = {
    telegramUserId: string;
    displayName: string;
    isHost: boolean;
    isReady: boolean;
    joinedAt: number;
};

export type BattleBossState = {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    phase: BossPhase;
};

export type BattlePlayerState = {
    telegramUserId: string;
    displayName: string;
    hp: number;
    maxHp: number;
    combo: number;
    maxCombo: number;
    damage: number;
    perfectCount: number;
    goodCount: number;
    missCount: number;
    wrongCount: number;
    deaths: number;
    isStunned: boolean;
    stunnedUntil: number | null;
};

export type BattleState = {
    status: BattleStatus;
    outcome: BattleOutcome;
    startedAt: number;
    endsAt: number;
    durationSeconds: number;
    boss: BattleBossState;
    players: Record<string, BattlePlayerState>;
};

export type Raid = {
    id: string;
    telegramChatId: string;
    hostTelegramUserId: string;
    hostDisplayName: string;
    status: RaidStatus;
    createdAt: number;
    expiresAt: number;
    players: Record<string, RaidPlayer>;
    battle: BattleState | null;
};

export type RaidState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "loaded"; raid: Raid; serverTime: number }
    | { status: "error"; message: string };

export type TelegramUser = {
    id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
};

export type CurrentUser = {
    id: string;
    displayName: string;
    source: "telegram" | "dev" | "local";
};

export type SocketStatus =
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "error";

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

export type BattleAttackPayload = {
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
    "battle:attack": (payload: BattleAttackPayload) => void;
};

export type ServerToClientEvents = {
    "raid:state": (payload: RaidStatePayload) => void;
    "socket:error": (payload: SocketErrorPayload) => void;
};