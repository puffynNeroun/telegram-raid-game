import type { BossConfig, BossId } from "./raid.types.js";

export const BOSS_CONFIGS: Record<BossId, BossConfig> = {
    "boss-001": {
        id: "boss-001",
        level: 1,
        name: "Meme Boss",
        subtitle: "Blooming Brute",
        assetSlug: "rosemaul",

        durationSeconds: 95,
        baseHp: 3200,
        playerMaxHp: 100,

        hpMultiplierByPlayers: {
            1: 1,
            2: 1.8,
            3: 2.55,
            4: 3.3,
            5: 4.05,
            6: 4.75
        },

        note: {
            introCountdownMs: 3000,

            firstHitDelayMs: 1500,
            intervalMs: 900,
            visibleAheadMs: 2800,

            perfectWindowMs: 95,
            goodWindowMs: 185,
            missWindowMs: 325
        },

        scoring: {
            attackDamage: 0,

            perfectDamage: 46,
            goodDamage: 30,
            wrongDamage: 0,
            missDamage: 0,

            wrongPlayerDamage: 8,
            missPlayerDamage: 11,

            stunDurationMs: 800,

            comboBonusEvery: 6,
            comboBonusStep: 4,
            comboBonusCap: 20
        }
    },

    "boss-002": {
        id: "boss-002",
        level: 2,
        name: "Raid Boss II",
        subtitle: "Second Contact",
        assetSlug: "boss-002",

        durationSeconds: 160,
        baseHp: 6800,
        playerMaxHp: 100,

        hpMultiplierByPlayers: {
            1: 1,
            2: 1.9,
            3: 2.85,
            4: 3.75,
            5: 4.6,
            6: 5.35
        },

        note: {
            introCountdownMs: 2800,
            firstHitDelayMs: 1700,
            intervalMs: 980,
            visibleAheadMs: 3100,

            perfectWindowMs: 90,
            goodWindowMs: 180,
            missWindowMs: 320
        },

        scoring: {
            attackDamage: 0,

            perfectDamage: 44,
            goodDamage: 27,
            wrongDamage: 0,
            missDamage: 0,

            wrongPlayerDamage: 8,
            missPlayerDamage: 11,

            stunDurationMs: 850,

            comboBonusEvery: 6,
            comboBonusStep: 4,
            comboBonusCap: 22
        }
    },

    "boss-003": {
        id: "boss-003",
        level: 3,
        name: "Raid Boss III",
        subtitle: "Pressure Rising",
        assetSlug: "boss-003",

        durationSeconds: 165,
        baseHp: 8400,
        playerMaxHp: 100,

        hpMultiplierByPlayers: {
            1: 1,
            2: 1.95,
            3: 2.95,
            4: 3.9,
            5: 4.8,
            6: 5.55
        },

        note: {
            introCountdownMs: 2600,
            firstHitDelayMs: 1600,
            intervalMs: 920,
            visibleAheadMs: 3000,

            perfectWindowMs: 86,
            goodWindowMs: 170,
            missWindowMs: 305
        },

        scoring: {
            attackDamage: 0,

            perfectDamage: 46,
            goodDamage: 28,
            wrongDamage: 0,
            missDamage: 0,

            wrongPlayerDamage: 9,
            missPlayerDamage: 12,

            stunDurationMs: 900,

            comboBonusEvery: 6,
            comboBonusStep: 5,
            comboBonusCap: 24
        }
    },

    "boss-004": {
        id: "boss-004",
        level: 4,
        name: "Raid Boss IV",
        subtitle: "No Free Hits",
        assetSlug: "boss-004",

        durationSeconds: 170,
        baseHp: 10400,
        playerMaxHp: 100,

        hpMultiplierByPlayers: {
            1: 1,
            2: 2,
            3: 3.05,
            4: 4.05,
            5: 5,
            6: 5.75
        },

        note: {
            introCountdownMs: 2400,
            firstHitDelayMs: 1500,
            intervalMs: 860,
            visibleAheadMs: 2900,

            perfectWindowMs: 82,
            goodWindowMs: 160,
            missWindowMs: 290
        },

        scoring: {
            attackDamage: 0,

            perfectDamage: 48,
            goodDamage: 29,
            wrongDamage: 0,
            missDamage: 0,

            wrongPlayerDamage: 10,
            missPlayerDamage: 13,

            stunDurationMs: 950,

            comboBonusEvery: 6,
            comboBonusStep: 5,
            comboBonusCap: 26
        }
    },

    "boss-005": {
        id: "boss-005",
        level: 5,
        name: "Raid Boss V",
        subtitle: "Execution Check",
        assetSlug: "boss-005",

        durationSeconds: 175,
        baseHp: 12800,
        playerMaxHp: 100,

        hpMultiplierByPlayers: {
            1: 1,
            2: 2.05,
            3: 3.15,
            4: 4.2,
            5: 5.2,
            6: 6
        },

        note: {
            introCountdownMs: 2200,
            firstHitDelayMs: 1400,
            intervalMs: 800,
            visibleAheadMs: 2800,

            perfectWindowMs: 78,
            goodWindowMs: 150,
            missWindowMs: 275
        },

        scoring: {
            attackDamage: 0,

            perfectDamage: 50,
            goodDamage: 30,
            wrongDamage: 0,
            missDamage: 0,

            wrongPlayerDamage: 11,
            missPlayerDamage: 14,

            stunDurationMs: 1000,

            comboBonusEvery: 6,
            comboBonusStep: 5,
            comboBonusCap: 28
        }
    },

    "boss-006": {
        id: "boss-006",
        level: 6,
        name: "Raid Boss VI",
        subtitle: "Final Problem",
        assetSlug: "boss-006",

        durationSeconds: 180,
        baseHp: 15800,
        playerMaxHp: 100,

        hpMultiplierByPlayers: {
            1: 1,
            2: 2.1,
            3: 3.25,
            4: 4.35,
            5: 5.4,
            6: 6.25
        },

        note: {
            introCountdownMs: 2000,
            firstHitDelayMs: 1300,
            intervalMs: 740,
            visibleAheadMs: 2700,

            perfectWindowMs: 72,
            goodWindowMs: 140,
            missWindowMs: 255
        },

        scoring: {
            attackDamage: 0,

            perfectDamage: 52,
            goodDamage: 31,
            wrongDamage: 0,
            missDamage: 0,

            wrongPlayerDamage: 12,
            missPlayerDamage: 15,

            stunDurationMs: 1100,

            comboBonusEvery: 6,
            comboBonusStep: 6,
            comboBonusCap: 30
        }
    }
};

export const DEFAULT_BOSS_ID: BossId = "boss-001";

export function getBossConfig(bossId: BossId | string | null | undefined): BossConfig {
    if (bossId && bossId in BOSS_CONFIGS) {
        return BOSS_CONFIGS[bossId as BossId];
    }

    return BOSS_CONFIGS[DEFAULT_BOSS_ID];
}