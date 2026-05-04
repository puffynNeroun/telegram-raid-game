import { useMemo, useState, type CSSProperties } from "react";
import { formatClock, getBossHpPercent } from "../components/battleUi";
import type {
    BeatdownHitType,
    BattleState,
    CurrentUser,
    Raid,
    RaidPlayer,
    SocketStatus
} from "../types";
import "./RaidBeatdownScreen.css";

type RaidBeatdownScreenProps = {
    raid: Raid;
    battle: BattleState;
    raidId: string;
    chatId: string | null;
    currentUser: CurrentUser;
    players: RaidPlayer[];
    localNow: number;
    socketStatus: SocketStatus;
    socketError: string | null;
    gameError: string | null;
    isInputSending: boolean;
    onRefresh: () => void;
    onBeatdownHit: (hitType: BeatdownHitType) => void;
};

type BossStageView = {
    key: "100" | "66" | "33" | "0";
    label: string;
    src: string;
};

type HitFxState = {
    id: number;
    hitType: BeatdownHitType;
};

type BattleAnnouncement = {
    title: string;
    description: string;
    toneClassName: "is-victory" | "is-defeat";
};

const HIT_FX_DURATION_MS = 260;

export function RaidBeatdownScreen({
                                       raid,
                                       battle,
                                       currentUser,
                                       players,
                                       localNow,
                                       gameError,
                                       isInputSending,
                                       onBeatdownHit
                                   }: RaidBeatdownScreenProps) {
    const [hitFx, setHitFx] = useState<HitFxState | null>(null);

    const currentBattlePlayer = battle.players[currentUser.id] ?? null;
    const currentBeatdownPlayer =
        battle.beatdown?.players[currentUser.id] ?? null;

    const isBattleConcluded =
        raid.status === "finished" || battle.status === "finished";

    const resolvedOutcome = getResolvedBattleOutcome(battle);
    const announcement = isBattleConcluded
        ? getBattleAnnouncement(resolvedOutcome)
        : null;

    const introRemainingMs = getBattleIntroRemainingMs({
        battle,
        localNow,
        isBattleConcluded
    });

    const isBattleIntroActive = introRemainingMs > 0;
    const introLabel = getBattleIntroLabel(introRemainingMs);

    const bossAssetSlug = getBossAssetSlug(battle);
    const bossHpPercent = getBossHpPercent(battle.boss.hp, battle.boss.maxHp);
    const bossStage = getBossStage({
        bossHpPercent,
        assetSlug: bossAssetSlug,
        subtitle: battle.boss.subtitle
    });

    const battleTimeLeft = isBattleConcluded
        ? "0:00"
        : formatClock(battle.endsAt, localNow);

    const teamDamage = Math.max(0, battle.boss.maxHp - battle.boss.hp);

    const kickCharge = currentBeatdownPlayer?.kickCharge ?? 0;
    const kickChargeMax = currentBeatdownPlayer?.kickChargeMax ?? 100;
    const kickChargePercent = getPercent(kickCharge, kickChargeMax);
    const isKickReady = kickChargePercent >= 100;

    const stamina = getPredictedStamina(currentBeatdownPlayer, localNow);
    const staminaMax = currentBeatdownPlayer?.staminaMax ?? 100;
    const staminaPercent = getPercent(stamina, staminaMax);

    const isCurrentPlayerDefeated = Boolean(
        currentBattlePlayer && currentBattlePlayer.hp <= 0
    );

    const canHit = Boolean(
        battle.status === "active" &&
        battle.combatMode === "beatdown" &&
        !isBattleConcluded &&
        !isBattleIntroActive &&
        currentBattlePlayer &&
        currentBeatdownPlayer &&
        !isCurrentPlayerDefeated
    );

    const canLeftPunch = Boolean(
        canHit &&
        stamina >= 8 &&
        currentBeatdownPlayer?.lastHitType !== "left"
    );

    const canRightPunch = Boolean(
        canHit &&
        stamina >= 8 &&
        currentBeatdownPlayer?.lastHitType !== "right"
    );

    const canKick = Boolean(canHit && isKickReady && stamina >= 30);

    const nextPunchHint = getNextPunchHint(
        currentBeatdownPlayer?.lastHitType ?? null
    );

    const stageClassName = [
        "raid-beatdown-stage",
        isBattleConcluded ? "is-concluded" : "",
        isBattleIntroActive ? "is-intro" : "",
        hitFx ? `is-hit-${hitFx.hitType}` : "",
        isKickReady ? "is-kick-ready" : "",
        announcement?.toneClassName ?? ""
    ]
        .filter(Boolean)
        .join(" ");

    const handleHit = (hitType: BeatdownHitType) => {
        if (!canHit) {
            return;
        }

        if (hitType === "kick" && !isKickReady) {
            triggerHitFx();
            return;
        }

        const nextHitFx = {
            id: Date.now(),
            hitType
        };

        setHitFx(nextHitFx);
        window.setTimeout(() => {
            setHitFx((currentHitFx) => {
                return currentHitFx?.id === nextHitFx.id ? null : currentHitFx;
            });
        }, HIT_FX_DURATION_MS);

        onBeatdownHit(hitType);
    };

    const lastDamage = currentBattlePlayer?.lastDamageDealt ?? 0;
    const lastHitType = currentBeatdownPlayer?.lastHitType ?? null;

    const playerCards = useMemo(() => {
        return Object.values(battle.players).sort((firstPlayer, secondPlayer) => {
            return secondPlayer.damage - firstPlayer.damage;
        });
    }, [battle.players]);

    return (
        <main className="raid-beatdown-page">
            <section
                className={stageClassName}
                style={
                    {
                        "--raid-arena-image": `url('/raid/${bossAssetSlug}/arena.png')`,
                        "--kick-charge": `${kickChargePercent}%`,
                        "--stamina": `${staminaPercent}%`
                    } as CSSProperties
                }
            >
                <header className="raid-beatdown-top-hud">
                    <div className="raid-beatdown-brand">
                        <span>BEATDOWN</span>
                        <strong>{players.length}/6 players</strong>
                    </div>

                    <div className="raid-beatdown-timer">
                        <span>
                            {isBattleConcluded
                                ? "Ended"
                                : isBattleIntroActive
                                    ? "Ready"
                                    : "Time"}
                        </span>

                        <strong>
                            {isBattleIntroActive ? introLabel : battleTimeLeft}
                        </strong>
                    </div>

                    <div className="raid-beatdown-state">
                        <span>{raid.status}</span>
                        <strong>{bossStage.label}</strong>
                    </div>
                </header>

                {gameError && (
                    <div className="raid-beatdown-error">{gameError}</div>
                )}

                <section className="raid-beatdown-boss-hud">
                    <div className="raid-beatdown-boss-title">
                        <span>{formatBossLevel(battle.boss.level)}</span>
                        <h1>{battle.boss.name}</h1>
                    </div>

                    <div className="raid-beatdown-boss-hp-row">
                        <div className="raid-beatdown-boss-hp-bar">
                            <div
                                className="raid-beatdown-boss-hp-fill"
                                style={{ width: `${bossHpPercent}%` }}
                            />
                        </div>

                        <strong>{Math.round(bossHpPercent)}%</strong>
                    </div>
                </section>

                <section className="raid-beatdown-arena">
                    <div className="raid-beatdown-vignette" aria-hidden="true" />

                    <aside className="raid-beatdown-side-stats is-left">
                        <div className="raid-beatdown-stat-card">
                            <span>Damage</span>
                            <strong>{teamDamage}</strong>
                        </div>

                        <div className="raid-beatdown-stat-card">
                            <span>Combo</span>
                            <strong>{currentBattlePlayer?.combo ?? 0}</strong>
                        </div>
                    </aside>

                    <aside className="raid-beatdown-side-stats is-right">
                        <div className="raid-beatdown-stat-card">
                            <span>Your HP</span>
                            <strong>
                                {currentBattlePlayer?.hp ?? 0}/
                                {currentBattlePlayer?.maxHp ?? 100}
                            </strong>
                        </div>

                        <div className="raid-beatdown-stat-card">
                            <span>Kick</span>
                            <strong>{Math.round(kickChargePercent)}%</strong>
                        </div>
                        <div className="raid-beatdown-stat-card">
                            <span>Stamina</span>
                            <strong>{Math.round(staminaPercent)}%</strong>
                        </div>
                    </aside>

                    <div className="raid-beatdown-boss-wrap">
                        <img
                            className={`raid-beatdown-boss raid-beatdown-boss-${bossStage.key}`}
                            src={bossStage.src}
                            alt={`${battle.boss.name} ${bossStage.label}`}
                            draggable={false}
                        />

                        {hitFx && (
                            <div
                                className={`raid-beatdown-impact raid-beatdown-impact-${hitFx.hitType}`}
                                key={hitFx.id}
                            >
                                <span>{hitFx.hitType === "kick" ? "💥" : "✦"}</span>
                            </div>
                        )}

                        {lastDamage > 0 && !isBattleConcluded && (
                            <div className="raid-beatdown-damage-pop" key={lastDamage + String(lastHitType)}>
                                -{lastDamage}
                            </div>
                        )}
                    </div>

                    <div className="raid-beatdown-hands" aria-hidden="true">
                        <div className="raid-beatdown-fist is-left">✊</div>
                        <div className="raid-beatdown-fist is-right">✊</div>
                    </div>

                    {isBattleIntroActive && (
                        <section className="raid-beatdown-intro" aria-live="polite">
                            <div className="raid-beatdown-intro-frame">
                                <span>Beatdown starts in</span>
                                <strong>{introLabel}</strong>
                                <p>Charge the kick with punches. Finish him clean.</p>
                            </div>
                        </section>
                    )}

                    {announcement && (
                        <section
                            className={`raid-beatdown-announcement ${announcement.toneClassName}`}
                            aria-live="assertive"
                        >
                            <div className="raid-beatdown-announcement-frame">
                                <span>Beatdown result</span>
                                <h2>{announcement.title}</h2>
                                <p>{announcement.description}</p>
                            </div>
                        </section>
                    )}
                </section>

                <section className="raid-beatdown-bottom-hud">
                    <div className="raid-beatdown-player-strip">
                        {playerCards.slice(0, 3).map((player, index) => (
                            <div className="raid-beatdown-player-pill" key={player.telegramUserId}>
                                <span>{index + 1}</span>
                                <strong>{player.displayName}</strong>
                                <em>{player.damage} dmg</em>
                            </div>
                        ))}
                    </div>

                    <div className="raid-beatdown-charge-panel">
                        <div className="raid-beatdown-charge-header">
                            <span>Kick charge</span>
                            <strong>{isKickReady ? "READY" : `${Math.round(kickChargePercent)}%`}</strong>
                        </div>

                        <div className="raid-beatdown-charge-bar">
                            <div
                                className="raid-beatdown-charge-fill"
                                style={{ width: `${kickChargePercent}%` }}
                            />
                        </div>
                    </div>

                    <div className="raid-beatdown-stamina-panel">
                        <div className="raid-beatdown-stamina-header">
                            <span>Stamina</span>
                            <strong>{Math.round(staminaPercent)}%</strong>
                        </div>

                        <div className="raid-beatdown-stamina-bar">
                            <div
                                className="raid-beatdown-stamina-fill"
                                style={{ width: `${staminaPercent}%` }}
                            />
                        </div>

                        <div className="raid-beatdown-combo-hint">
                            {nextPunchHint}
                        </div>
                    </div>

                    <div className="raid-beatdown-controls">
                        <button
                            className="raid-beatdown-action is-left"
                            type="button"
                            disabled={!canLeftPunch || isInputSending}
                            onClick={() => handleHit("left")}
                        >
                            <span>Left</span>
                            <strong>✊</strong>
                        </button>

                        <button
                            className={`raid-beatdown-action is-kick ${
                                isKickReady ? "is-ready" : ""
                            }`}
                            type="button"
                            disabled={!canKick || isInputSending}
                            onClick={() => handleHit("kick")}
                        >
                            <span>{isKickReady ? "Kick" : "Charge"}</span>
                            <strong>🦶</strong>
                        </button>

                        <button
                            className="raid-beatdown-action is-right"
                            type="button"
                            disabled={!canRightPunch || isInputSending}
                            onClick={() => handleHit("right")}
                        >
                            <span>Right</span>
                            <strong>✊</strong>
                        </button>
                    </div>
                </section>
            </section>
        </main>
    );
}

function triggerHitFx(): void {
    if (navigator.vibrate) {
        navigator.vibrate(35);
    }
}

function getBossAssetSlug(battle: BattleState): string {
    const assetSlug = battle.boss.assetSlug?.trim();

    return assetSlug || "rosemaul";
}

function getBossStage(input: {
    bossHpPercent: number;
    assetSlug: string;
    subtitle: string;
}): BossStageView {
    const basePath = `/raid/${input.assetSlug}`;

    if (input.bossHpPercent <= 0) {
        return {
            key: "0",
            label: "Knockout",
            src: `${basePath}/boss-0.png`
        };
    }

    if (input.bossHpPercent <= 33) {
        return {
            key: "33",
            label: "Rage face",
            src: `${basePath}/boss-33.png`
        };
    }

    if (input.bossHpPercent <= 66) {
        return {
            key: "66",
            label: "Wobbly",
            src: `${basePath}/boss-66.png`
        };
    }

    return {
        key: "100",
        label: input.subtitle || "Fresh",
        src: `${basePath}/boss-100.png`
    };
}

function getBattleIntroRemainingMs(input: {
    battle: BattleState;
    localNow: number;
    isBattleConcluded: boolean;
}): number {
    if (input.isBattleConcluded || input.localNow <= 0) {
        return 0;
    }

    return Math.max(0, input.battle.introEndsAt - input.localNow);
}

function getBattleIntroLabel(remainingMs: number): string {
    if (remainingMs <= 0) {
        return "FIGHT";
    }

    const seconds = Math.ceil(remainingMs / 1000);

    return String(seconds);
}

function getResolvedBattleOutcome(
    battle: BattleState
): Exclude<BattleState["outcome"], null> {
    if (battle.outcome) {
        return battle.outcome;
    }

    return battle.boss.hp <= 0 ? "win" : "lose";
}

function getBattleAnnouncement(
    outcome: Exclude<BattleState["outcome"], null>
): BattleAnnouncement {
    if (outcome === "win") {
        return {
            title: "Boss dropped",
            description: "Clean work. The squad turned this into a highlight reel.",
            toneClassName: "is-victory"
        };
    }

    return {
        title: "Boss survived",
        description: "Not enough pressure. Run it back and stop tickling him.",
        toneClassName: "is-defeat"
    };
}

function formatBossLevel(level: number): string {
    const safeLevel = Number.isFinite(level) ? level : 1;

    return `LV.${safeLevel}`;
}

function getPercent(value: number, maxValue: number): number {
    if (maxValue <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(100, (value / maxValue) * 100));
}

function getPredictedStamina(
    player: { stamina: number; staminaMax: number; staminaRegenPerSecond: number; lastStaminaUpdatedAt: number } | null,
    localNow: number
): number {
    if (!player) {
        return 0;
    }

    if (localNow <= 0) {
        return player.stamina;
    }

    const elapsedMs = Math.max(0, localNow - player.lastStaminaUpdatedAt);
    const regenerated = player.stamina + (elapsedMs / 1000) * player.staminaRegenPerSecond;

    return Math.min(player.staminaMax, regenerated);
}

function getNextPunchHint(lastHitType: BeatdownHitType | null): string {
    if (lastHitType === "left") {
        return "Next clean punch: RIGHT";
    }

    if (lastHitType === "right") {
        return "Next clean punch: LEFT";
    }

    if (lastHitType === "kick") {
        return "Kick landed. Start a new combo.";
    }

    return "Alternate hands to keep pressure.";
}