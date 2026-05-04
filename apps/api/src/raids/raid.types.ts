export const RAID_TTL_SECONDS = 120;
export const MAX_PLAYERS_PER_RAID = 6;

export const BATTLE_RESULT_TTL_SECONDS = 180;

export const BATTLE_INPUT_KEYS = ["left", "up", "down", "right"] as const;
export const RAID_COMBAT_MODES = ["rhythm", "beatdown"] as const;
export const BEATDOWN_HIT_TYPES = ["left", "right", "kick"] as const;

/**
 * Legacy fallback constants.
 * Main battle balance now lives in boss.config.ts.
 */
export const BATTLE_DURATION_SECONDS = 95;
export const BASE_BOSS_HP = 3200;
export const PLAYER_MAX_HP = 100;

export const BATTLE_ATTACK_DAMAGE = 0;
export const BATTLE_INPUT_DAMAGE = 0;

export const BATTLE_NOTE_INTRO_COUNTDOWN_MS = 3000;
export const BATTLE_NOTE_FIRST_HIT_DELAY_MS = 1500;
export const BATTLE_NOTE_INTERVAL_MS = 900;
export const BATTLE_NOTE_VISIBLE_AHEAD_MS = 2800;

export const BATTLE_NOTE_PERFECT_WINDOW_MS = 95;
export const BATTLE_NOTE_GOOD_WINDOW_MS = 185;
export const BATTLE_NOTE_MISS_WINDOW_MS = 325;

export const BATTLE_PERFECT_DAMAGE = 46;
export const BATTLE_GOOD_DAMAGE = 30;
export const BATTLE_WRONG_DAMAGE = 0;
export const BATTLE_MISS_DAMAGE = 0;

export const BATTLE_WRONG_PLAYER_DAMAGE = 8;
export const BATTLE_MISS_PLAYER_DAMAGE = 11;
export const BATTLE_STUN_DURATION_MS = 800;

export type RaidStatus = "lobby" | "cancelled" | "battle" | "finished";

export type BattleStatus = "active" | "finished";
export type BattleOutcome = "win" | "lose" | null;
export type BossPhase = "idle" | "hurt" | "rage" | "defeated";

export type BattleInputKey = (typeof BATTLE_INPUT_KEYS)[number];
export type RaidCombatMode = (typeof RAID_COMBAT_MODES)[number];
export type BeatdownHitType = (typeof BEATDOWN_HIT_TYPES)[number];

export type BattleNoteStatus = "pending" | "hit" | "missed";
export type BattleInputRating = "perfect" | "good" | "miss" | "wrong";

export type BossId =
    | "boss-001"
    | "boss-002"
    | "boss-003"
    | "boss-004"
    | "boss-005"
    | "boss-006";

export type BossHpMultiplierByPlayers = Record<1 | 2 | 3 | 4 | 5 | 6, number>;

export type BossNoteConfig = {
    introCountdownMs: number;

    firstHitDelayMs: number;
    intervalMs: number;
    visibleAheadMs: number;

    perfectWindowMs: number;
    goodWindowMs: number;
    missWindowMs: number;
};

export type BossScoringConfig = {
    attackDamage: number;

    perfectDamage: number;
    goodDamage: number;
    wrongDamage: number;
    missDamage: number;

    wrongPlayerDamage: number;
    missPlayerDamage: number;

    stunDurationMs: number;

    comboBonusEvery: number;
    comboBonusStep: number;
    comboBonusCap: number;
};

export type BossConfig = {
    id: BossId;
    level: number;
    name: string;
    subtitle: string;
    assetSlug: string;

    durationSeconds: number;
    baseHp: number;
    playerMaxHp: number;

    hpMultiplierByPlayers: BossHpMultiplierByPlayers;

    note: BossNoteConfig;
    scoring: BossScoringConfig;
};

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

export type CreateRaidInput = {
    telegramChatId: string;
    hostTelegramUserId: string;
    hostDisplayName: string;
    bossId?: BossId;
    combatMode?: RaidCombatMode;
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

export type SelectRaidBossInput = {
    raidId: string;
    telegramUserId: string;
    bossId: BossId;
};

export type SelectRaidBossResult =
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
        | "only_host_can_select_boss"
        | "invalid_boss_id";
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

export type BeatdownHitInput = {
    raidId: string;
    telegramUserId: string;
    hitType: BeatdownHitType;
};

export type BeatdownHitResult =
    | {
    ok: true;
    raid: Raid;
    hitType: BeatdownHitType;
    damageDealt: number;
    combo: number;
    kickCharge: number;
    kickChargeMax: number;
    stamina: number;
    staminaMax: number;
}
    | {
    ok: false;
    reason:
        | "raid_not_found"
        | "no_active_battle"
        | "battle_expired"
        | "wrong_combat_mode"
        | "beatdown_state_missing"
        | "player_not_in_battle"
        | "player_defeated"
        | "kick_not_charged"
        | "not_enough_stamina"
        | "repeated_punch"
        | "hit_on_cooldown"
        | "invalid_beatdown_hit_type";
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