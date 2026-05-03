import { getBossHpPercent } from "./battleUi";
import type { BattleState, BossId, RaidStatus } from "../types";

type BossPanelProps = {
    battle: BattleState | null;
    raidStatus: RaidStatus | null;
    bossId?: BossId | null;
};

type BossPanelViewModel = {
    id: BossId;
    level: number;
    name: string;
    subtitle: string;
    assetSlug: string;
};

const DEFAULT_BOSS_ID: BossId = "boss-001";

const BOSS_PANEL_FALLBACKS: Record<BossId, BossPanelViewModel> = {
    "boss-001": {
        id: "boss-001",
        level: 1,
        name: "Meme Boss",
        subtitle: "Blooming Brute",
        assetSlug: "rosemaul"
    },
    "boss-002": {
        id: "boss-002",
        level: 2,
        name: "Raid Boss II",
        subtitle: "Second Contact",
        assetSlug: "boss-002"
    },
    "boss-003": {
        id: "boss-003",
        level: 3,
        name: "Raid Boss III",
        subtitle: "Pressure Rising",
        assetSlug: "boss-003"
    },
    "boss-004": {
        id: "boss-004",
        level: 4,
        name: "Raid Boss IV",
        subtitle: "No Free Hits",
        assetSlug: "boss-004"
    },
    "boss-005": {
        id: "boss-005",
        level: 5,
        name: "Raid Boss V",
        subtitle: "Execution Check",
        assetSlug: "boss-005"
    },
    "boss-006": {
        id: "boss-006",
        level: 6,
        name: "Raid Boss VI",
        subtitle: "Final Problem",
        assetSlug: "boss-006"
    }
};

export function BossPanel({ battle, raidStatus, bossId }: BossPanelProps) {
    const boss = getBossPanelViewModel({
        battle,
        bossId
    });

    const bossHpPercent = battle
        ? getBossHpPercent(battle.boss.hp, battle.boss.maxHp)
        : 100;

    const hpLabel = getBossHpLabel({
        battle,
        raidStatus
    });

    const phaseLabel = getBossPhaseLabel({
        battle,
        raidStatus
    });

    const iconSrc = getBossIconSrc(boss);
    const fallbackArtSrc = getBossFallbackArtSrc(boss);

    return (
        <section className="boss-panel">
            <div className="boss-art" aria-hidden="true">
                <img
                    className="boss-art-image"
                    src={iconSrc}
                    alt=""
                    draggable={false}
                    onError={(event) => {
                        const image = event.currentTarget;

                        if (image.src.endsWith(fallbackArtSrc)) {
                            return;
                        }

                        image.src = fallbackArtSrc;
                    }}
                />
            </div>

            <div className="boss-info">
                <div className="boss-row">
                    <div className="boss-title-stack">
                        <span className="boss-level-pill">
                            {formatBossLevel(boss.level)}
                        </span>

                        <h2>{boss.name}</h2>

                        <strong>{boss.subtitle}</strong>
                    </div>

                    <div className="boss-hp-meta">
                        <span>{phaseLabel}</span>
                        <strong>{hpLabel}</strong>
                    </div>
                </div>

                <div className="hp-bar" aria-label="Boss health">
                    <div
                        className="hp-bar-fill"
                        style={{ width: `${bossHpPercent}%` }}
                    />
                </div>
            </div>
        </section>
    );
}

function getBossPanelViewModel(input: {
    battle: BattleState | null;
    bossId?: BossId | null;
}): BossPanelViewModel {
    if (input.battle) {
        return {
            id: input.battle.boss.id,
            level: input.battle.boss.level,
            name: input.battle.boss.name,
            subtitle: input.battle.boss.subtitle,
            assetSlug: input.battle.boss.assetSlug
        };
    }

    return BOSS_PANEL_FALLBACKS[input.bossId ?? DEFAULT_BOSS_ID];
}

function getBossIconSrc(boss: BossPanelViewModel): string {
    return `/raid/${boss.assetSlug}/${formatBossIconFileName(boss.level)}`;
}

function getBossFallbackArtSrc(boss: BossPanelViewModel): string {
    return `/raid/${boss.assetSlug}/boss-100.png`;
}

function formatBossIconFileName(level: number): string {
    const safeLevel = Number.isFinite(level) ? level : 1;

    return `${String(safeLevel).padStart(2, "0")}_icon.png`;
}

function getBossHpLabel(input: {
    battle: BattleState | null;
    raidStatus: RaidStatus | null;
}): string {
    if (input.battle) {
        return `${Math.max(0, input.battle.boss.hp)}/${input.battle.boss.maxHp} HP`;
    }

    if (input.raidStatus === "battle") {
        return "Battle started";
    }

    if (input.raidStatus === "finished") {
        return "Battle ended";
    }

    return "Lobby phase";
}

function getBossPhaseLabel(input: {
    battle: BattleState | null;
    raidStatus: RaidStatus | null;
}): string {
    if (!input.battle) {
        return input.raidStatus === "lobby" ? "Waiting" : "Pending";
    }

    if (input.battle.outcome === "win") {
        return "Defeated";
    }

    if (input.battle.outcome === "lose") {
        return "Survived";
    }

    switch (input.battle.boss.phase) {
        case "defeated":
            return "Defeated";
        case "rage":
            return "Enraged";
        case "hurt":
            return "Wounded";
        case "idle":
            return "Stable";
    }
}

function formatBossLevel(level: number): string {
    const safeLevel = Number.isFinite(level) ? level : 1;

    return `Level ${String(safeLevel).padStart(2, "0")}`;
}