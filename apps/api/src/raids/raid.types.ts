export const RAID_TTL_SECONDS = 120;
export const MAX_PLAYERS_PER_RAID = 6;

export const BATTLE_DURATION_SECONDS = 60;
export const BATTLE_RESULT_TTL_SECONDS = 120;

export const BASE_BOSS_HP = 1000;
export const PLAYER_MAX_HP = 100;

export const BATTLE_ATTACK_DAMAGE = 50;
export const BATTLE_INPUT_DAMAGE = 25;

export const BATTLE_NOTE_FIRST_HIT_DELAY_MS = 1800;
export const BATTLE_NOTE_INTERVAL_MS = 850;
export const BATTLE_NOTE_VISIBLE_AHEAD_MS = 1800;

export const BATTLE_NOTE_PERFECT_WINDOW_MS = 90;
export const BATTLE_NOTE_GOOD_WINDOW_MS = 180;
export const BATTLE_NOTE_MISS_WINDOW_MS = 320;

export const BATTLE_PERFECT_DAMAGE = 55;
export const BATTLE_GOOD_DAMAGE = 35;
export const BATTLE_WRONG_DAMAGE = 0;
export const BATTLE_MISS_DAMAGE = 0;

export const BATTLE_WRONG_PLAYER_DAMAGE = 8;
export const BATTLE_MISS_PLAYER_DAMAGE = 12;
export const BATTLE_STUN_DURATION_MS = 900;

export const BATTLE_INPUT_KEYS = ["left", "up", "down", "right"] as const;

export type RaidStatus = "lobby" | "cancelled" | "battle" | "finished";

export type BattleStatus = "active" | "finished";
export type BattleOutcome = "win" | "lose" | null;
export type BossPhase = "idle" | "hurt" | "rage" | "defeated";

export type BattleInputKey = (typeof BATTLE_INPUT_KEYS)[number];

export type BattleNoteStatus = "pending" | "hit" | "missed";
export type BattleInputRating = "perfect" | "good" | "miss" | "wrong";

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

export type BattleState = {
    status: BattleStatus;
    outcome: BattleOutcome;

    startedAt: number;
    endsAt: number;
    durationSeconds: number;

    boss: BattleBossState;
    players: Record<string, BattlePlayerState>;

    notesByPlayer: Record<string, BattleNote[]>;
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

export type CreateRaidInput = {
    telegramChatId: string;
    hostTelegramUserId: string;
    hostDisplayName: string;
};

export type CreateRaidResult =
    | {
    ok: true;
    raid: Raid;
}
    | {
    ok: false;
    reason: "active_raid_exists";
    activeRaid: Raid | null;
};

export type JoinRaidInput = {
    raidId: string;
    telegramUserId: string;
    displayName: string;
};

export type JoinRaidResult =
    | {
    ok: true;
    raid: Raid;
    player: RaidPlayer;
}
    | {
    ok: false;
    reason: "raid_not_found" | "raid_expired" | "raid_not_joinable" | "raid_full";
};

export type SetReadyInput = {
    raidId: string;
    telegramUserId: string;
    isReady: boolean;
};

export type SetReadyResult =
    | {
    ok: true;
    raid: Raid;
    player: RaidPlayer;
}
    | {
    ok: false;
    reason:
        | "raid_not_found"
        | "raid_expired"
        | "raid_not_joinable"
        | "player_not_in_raid";
};

export type StartRaidInput = {
    raidId: string;
    telegramUserId: string;
};

export type StartRaidResult =
    | {
    ok: true;
    raid: Raid;
}
    | {
    ok: false;
    reason:
        | "raid_not_found"
        | "raid_expired"
        | "raid_not_joinable"
        | "player_not_in_raid"
        | "only_host_can_start"
        | "no_ready_players";
};

export type FinalizeExpiredBattleResult =
    | {
    ok: true;
    raid: Raid;
    finalized: boolean;
}
    | {
    ok: false;
    reason: "raid_not_found" | "no_active_battle" | "battle_not_expired";
};

export type BattleAttackInput = {
    raidId: string;
    telegramUserId: string;
};

export type BattleAttackResult =
    | {
    ok: true;
    raid: Raid;
    damageDealt: number;
}
    | {
    ok: false;
    reason:
        | "raid_not_found"
        | "no_active_battle"
        | "battle_expired"
        | "player_not_in_battle"
        | "player_defeated";
};

export type BattleInputActionInput = {
    raidId: string;
    telegramUserId: string;
    key: BattleInputKey;
};

export type BattleInputActionResult =
    | {
    ok: true;
    raid: Raid;
    key: BattleInputKey;
    noteId: string | null;
    rating: BattleInputRating;
    damageDealt: number;
    damageTaken: number;
    combo: number;
}
    | {
    ok: false;
    reason:
        | "raid_not_found"
        | "no_active_battle"
        | "battle_expired"
        | "player_not_in_battle"
        | "player_stunned"
        | "player_defeated"
        | "invalid_input_key";
};

export type ResolveMissedNotesInput = {
    raidId: string;
};

export type ResolveMissedNotesResult =
    | {
    ok: true;
    raid: Raid;
    resolvedCount: number;
}
    | {
    ok: false;
    reason: "raid_not_found" | "no_active_battle";
};