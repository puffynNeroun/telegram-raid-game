import type { BossId } from "./raid.types.js";

export const BEATDOWN_BOSS_IDS: BossId[] = [
    "boss-001",
    "boss-002",
    "boss-003",
    "boss-004",
    "boss-006"
];

const BEATDOWN_BOSS_ID_SET = new Set<BossId>(BEATDOWN_BOSS_IDS);

export function isBeatdownBossId(bossId: BossId): boolean {
    return BEATDOWN_BOSS_ID_SET.has(bossId);
}

export function getDefaultBeatdownBossId(): BossId {
    return "boss-001";
}

export function resolveBeatdownBossId(bossId: BossId): BossId {
    return isBeatdownBossId(bossId) ? bossId : getDefaultBeatdownBossId();
}
