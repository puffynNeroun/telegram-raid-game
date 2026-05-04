import type { BossConfig, BossHpMultiplierByPlayers, BossId } from "./raid.types.js";

export type BeatdownBossBalance = {
    durationSeconds: number;
    baseHp: number;
};

export type BeatdownHitBalance = {
    punchDamage: number;
    punchKickChargeGain: number;
    punchStaminaCost: number;
    punchCooldownMs: number;

    kickDamage: number;
    kickRequiredCharge: number;
    kickStaminaCost: number;
    kickCooldownMs: number;
};

export type BeatdownPlayerBalance = {
    staminaMax: number;
    staminaRegenPerSecond: number;
    kickChargeMax: number;
};

export const BEATDOWN_BOSS_BALANCE_BY_ID: Record<BossId, BeatdownBossBalance> = {
    "boss-001": {
        durationSeconds: 40,
        baseHp: 1800
    },
    "boss-002": {
        durationSeconds: 45,
        baseHp: 2400
    },
    "boss-003": {
        durationSeconds: 50,
        baseHp: 3300
    },
    "boss-004": {
        durationSeconds: 55,
        baseHp: 4600
    },
    "boss-005": {
        durationSeconds: 60,
        baseHp: 6200
    },
    "boss-006": {
        durationSeconds: 70,
        baseHp: 9000
    }
};

export const BEATDOWN_HP_MULTIPLIER_BY_PLAYERS: BossHpMultiplierByPlayers = {
    1: 1,
    2: 1.65,
    3: 2.25,
    4: 2.8,
    5: 3.3,
    6: 3.75
};

export const BEATDOWN_HIT_BALANCE: BeatdownHitBalance = {
    punchDamage: 12,
    punchKickChargeGain: 12,
    punchStaminaCost: 8,
    punchCooldownMs: 105,

    kickDamage: 85,
    kickRequiredCharge: 100,
    kickStaminaCost: 30,
    kickCooldownMs: 650
};

export const BEATDOWN_PLAYER_BALANCE: BeatdownPlayerBalance = {
    staminaMax: 100,
    staminaRegenPerSecond: 28,
    kickChargeMax: 100
};

export function getBeatdownBossBalance(
    bossConfig: Pick<BossConfig, "id" | "baseHp" | "durationSeconds">
): BeatdownBossBalance {
    return (
        BEATDOWN_BOSS_BALANCE_BY_ID[bossConfig.id] ?? {
            durationSeconds: bossConfig.durationSeconds,
            baseHp: bossConfig.baseHp
        }
    );
}
