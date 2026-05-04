export type RaidStatus = "lobby" | "cancelled" | "battle" | "finished";

export type BattleStatus = "active" | "finished";
export type BattleOutcome = "win" | "lose" | null;
export type BossPhase = "idle" | "hurt" | "rage" | "defeated";

export type BattleInputKey = "left" | "up" | "down" | "right";
export type RaidCombatMode = "rhythm" | "beatdown";
export type BeatdownHitType = "left" | "right" | "kick";

export type BattleNoteStatus = "pending" | "hit" | "missed";
export type BattleInputRating = "perfect" | "good" | "miss" | "wrong";

export type BossId =
    | "boss-001"
    | "boss-002"
    | "boss-003"
    | "boss-004"
    | "boss-005"
    | "boss-006";

export type BossCatalogItem = {
    id: BossId;
    level: number;
    name: string;
    subtitle: string;
    assetSlug: string;
    durationSeconds: number;
    baseHp: number;
};

export type RaidPlayer = {
    telegramUserId: string;
    displayName: string;
    isHost: boolean;
    isReady: boolean;
    joinedAt: number;
};

export type BattleBossState = {
    id: BossId;
    level: number;
    name: string;
    subtitle: string;
    assetSlug: string;

    hp: number;
    maxHp: number;
    phase: BossPhase;
};

export type BattleNote = {
    id: string;
    telegramUserId: string;
    key: BattleInputKey;
    hitAt: number;
    status: BattleNoteStatus;
    rating: BattleInputRating | null;
    resolvedAt: number | null;
    inputAt: number | null;
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

    lastInputKey: BattleInputKey | null;
    lastInputAt: number | null;
    lastRating: BattleInputRating | null;
    lastDamageDealt: number;
    lastDamageTaken: number;
};

export type BeatdownPlayerState = {
    telegramUserId: string;
    displayName: string;

    stamina: number;
    staminaMax: number;
    staminaRegenPerSecond: number;
    lastStaminaUpdatedAt: number;

    kickCharge: number;
    kickChargeMax: number;

    lastHitType: BeatdownHitType | null;
    lastHitAt: number | null;
    lastHitDamage: number;

    lastKickAt: number | null;
};

export type BeatdownState = {
    players: Record<string, BeatdownPlayerState>;
};

export type BattleState = {
    status: BattleStatus;
    outcome: BattleOutcome;
    combatMode: RaidCombatMode;

    bossId: BossId;
    noteSeed: string;

    startedAt: number;
    introEndsAt: number;
    endsAt: number;
    durationSeconds: number;

    boss: BattleBossState;
    players: Record<string, BattlePlayerState>;

    notesByPlayer: Record<string, BattleNote[]>;
    beatdown: BeatdownState | null;
};

export type Raid = {
    id: string;
    bossId: BossId;
    combatMode: RaidCombatMode;

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