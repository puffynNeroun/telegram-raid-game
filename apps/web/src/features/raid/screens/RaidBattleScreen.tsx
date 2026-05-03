import { useMemo, type CSSProperties } from "react";
import { BattleControls } from "../components/BattleControls";
import {
    formatClock,
    formatRating,
    getBossHpPercent,
    getCurrentTargetNote,
    getNoteTimingClassName,
    getRatingClassName
} from "../components/battleUi";
import type {
    BattleInputKey,
    BattleNote,
    BattleState,
    CurrentUser,
    Raid,
    RaidPlayer,
    SocketStatus
} from "../types";
import "./RaidBattleScreen.css";

type RaidBattleScreenProps = {
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
    onBattleInput: (key: BattleInputKey) => void;
};

type BattleConclusionOutcome = Exclude<BattleState["outcome"], null>;

type BattleAnnouncement = {
    kicker: string;
    title: string;
    description: string;
    footer: string;
    toneClassName: "is-victory" | "is-defeat";
};

type BossStageView = {
    key: "100" | "66" | "33" | "0";
    label: string;
    src: string;
};

const LANES: BattleInputKey[] = ["left", "up", "down", "right"];

const NOTE_TRAVEL_MS = 2800;
const NOTE_LOOK_BEHIND_MS = 900;
const MAX_LANE_NOTES = 4;

export function RaidBattleScreen({
                                     raid,
                                     battle,
                                     currentUser,
                                     players,
                                     localNow,
                                     gameError,
                                     isInputSending,
                                     onBattleInput
                                 }: RaidBattleScreenProps) {
    const currentBattlePlayer = battle.players[currentUser.id] ?? null;

    const currentPlayerNotes = useMemo(() => {
        return battle.notesByPlayer[currentUser.id] ?? [];
    }, [battle.notesByPlayer, currentUser.id]);

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

    const visibleNotes = useMemo(() => {
        if (isBattleConcluded || isBattleIntroActive) {
            return [];
        }

        return getArenaVisibleNotes(currentPlayerNotes, localNow);
    }, [currentPlayerNotes, isBattleConcluded, isBattleIntroActive, localNow]);

    const currentTargetNote = useMemo(() => {
        if (isBattleConcluded || isBattleIntroActive) {
            return null;
        }

        return getCurrentTargetNote(currentPlayerNotes, localNow);
    }, [currentPlayerNotes, isBattleConcluded, isBattleIntroActive, localNow]);

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

    const battleOutcomeLabel = isBattleIntroActive
        ? "Ready"
        : getBattleOutcomeLabel({
            status: battle.status,
            outcome: resolvedOutcome,
            bossHpPercent
        });

    const isCurrentPlayerDefeated = Boolean(
        currentBattlePlayer && currentBattlePlayer.hp <= 0
    );

    const isCurrentPlayerStunned = Boolean(
        currentBattlePlayer &&
        currentBattlePlayer.isStunned &&
        currentBattlePlayer.stunnedUntil &&
        currentBattlePlayer.stunnedUntil > localNow
    );

    const canSendBattleInput = Boolean(
        battle.status === "active" &&
        !isBattleConcluded &&
        !isBattleIntroActive &&
        currentBattlePlayer &&
        !isCurrentPlayerDefeated &&
        !isCurrentPlayerStunned
    );

    const currentTimingClassName = currentTargetNote
        ? getNoteTimingClassName(currentTargetNote, localNow)
        : "is-waiting";

    return (
        <main className="raid-battle-page">
            <section
                className={`raid-battle-stage ${
                    isBattleConcluded ? "is-concluded" : ""
                } ${isBattleIntroActive ? "is-intro" : ""} ${
                    announcement?.toneClassName ?? ""
                }`}
                style={
                    {
                        "--raid-arena-image": `url('/raid/${bossAssetSlug}/arena.png')`
                    } as CSSProperties
                }
            >
                <header className="raid-battle-top-hud">
                    <div className="raid-battle-brand">
                        <span className="raid-battle-mark">RAID</span>
                        <strong>{players.length}/6 players</strong>
                    </div>

                    <div className="raid-battle-timer">
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

                    <div className="raid-battle-state">
                        <span>{raid.status}</span>
                        <strong>{battleOutcomeLabel}</strong>
                    </div>
                </header>

                {gameError && <div className="raid-battle-error">{gameError}</div>}

                <section className="raid-boss-hud">
                    <div className="raid-boss-title">
                        <span>{formatBossLevel(battle.boss.level)}</span>
                        <h1>{battle.boss.name}</h1>
                        <strong>{bossStage.label}</strong>
                    </div>

                    <div className="raid-boss-health-row">
                        <div className="raid-boss-hp-bar" aria-label="Boss health">
                            <div
                                className="raid-boss-hp-fill"
                                style={{ width: `${bossHpPercent}%` }}
                            />
                        </div>

                        <strong>{Math.round(bossHpPercent)}%</strong>
                    </div>

                    <p>
                        {Math.max(0, battle.boss.hp)}/{battle.boss.maxHp} HP
                    </p>
                </section>

                <section className="raid-arena">
                    <div className="raid-arena-vignette" aria-hidden="true" />

                    <div className="raid-boss-character-wrap">
                        <img
                            className={`raid-boss-character raid-boss-character-${bossStage.key}`}
                            src={bossStage.src}
                            alt={`${battle.boss.name} ${bossStage.label}`}
                            draggable={false}
                        />
                    </div>

                    <aside className="raid-side-stats raid-side-stats-left">
                        <div className="raid-stat-card">
                            <span>Total damage</span>
                            <strong>{teamDamage}</strong>
                        </div>

                        <div className="raid-stat-card">
                            <span>Best combo</span>
                            <strong>{currentBattlePlayer?.maxCombo ?? 0}</strong>
                        </div>
                    </aside>

                    <aside className="raid-side-stats raid-side-stats-right">
                        <div className="raid-stat-card raid-stat-card-combo">
                            <span>Combo</span>
                            <strong>{currentBattlePlayer?.combo ?? 0}</strong>
                        </div>

                        {currentBattlePlayer?.lastRating && !isBattleConcluded && (
                            <div
                                className={`raid-rating-card ${getRatingClassName(
                                    currentBattlePlayer.lastRating
                                )}`}
                            >
                                <strong>
                                    {formatRating(currentBattlePlayer.lastRating)}
                                </strong>

                                <span>
                                    {getRatingImpactText(
                                        currentBattlePlayer.lastDamageDealt,
                                        currentBattlePlayer.lastDamageTaken
                                    )}
                                </span>
                            </div>
                        )}
                    </aside>

                    {!isBattleConcluded && !isBattleIntroActive && (
                        <section
                            className="raid-note-highway"
                            aria-label="Battle note lanes"
                        >
                            {LANES.map((laneKey) => {
                                const laneNotes = visibleNotes
                                    .filter((note) => note.key === laneKey)
                                    .slice(0, MAX_LANE_NOTES);

                                const isCurrentLane = currentTargetNote?.key === laneKey;

                                return (
                                    <div
                                        className={`raid-note-lane raid-note-lane-${laneKey} ${
                                            isCurrentLane ? "is-current-lane" : ""
                                        }`}
                                        key={laneKey}
                                    >
                                        <div className="raid-note-string" />

                                        {laneNotes.map((note) => {
                                            const timingClassName = getNoteTimingClassName(
                                                note,
                                                localNow
                                            );

                                            return (
                                                <div
                                                    className={`raid-falling-note raid-falling-note-${note.key} ${timingClassName}`}
                                                    key={note.id}
                                                    style={getFallingNoteStyle(note, localNow)}
                                                >
                                                    <span
                                                        className="raid-note-icon"
                                                        aria-hidden="true"
                                                    >
                                                        <DirectionGlyph direction={note.key} />
                                                    </span>
                                                </div>
                                            );
                                        })}

                                        <div
                                            className={`raid-lane-target ${
                                                isCurrentLane ? currentTimingClassName : ""
                                            }`}
                                        >
                                            <span
                                                className="raid-note-icon"
                                                aria-hidden="true"
                                            >
                                                <DirectionGlyph direction={laneKey} />
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </section>
                    )}

                    {isBattleIntroActive && (
                        <section className="raid-battle-intro" aria-live="polite">
                            <div className="raid-battle-intro-frame">
                                <span className="raid-battle-intro-kicker">
                                    Raid starts in
                                </span>

                                <strong className="raid-battle-intro-count">
                                    {introLabel}
                                </strong>

                                <p>Get ready. First notes are incoming.</p>
                            </div>
                        </section>
                    )}

                    {announcement && (
                        <section
                            className={`raid-battle-announcement ${announcement.toneClassName}`}
                            aria-live="assertive"
                        >
                            <div className="raid-battle-announcement-frame">
                                <span className="raid-battle-announcement-kicker">
                                    {announcement.kicker}
                                </span>

                                <h2>{announcement.title}</h2>

                                <p>{announcement.description}</p>

                                <div className="raid-battle-announcement-footer">
                                    {announcement.footer}
                                </div>
                            </div>
                        </section>
                    )}
                </section>

                <section className="raid-bottom-hud">
                    <div className="raid-player-strip">
                        <div className="raid-player-card">
                            <div className="raid-player-avatar">
                                {isCurrentPlayerDefeated ? "💀" : "👑"}
                            </div>

                            <div>
                                <span>You</span>
                                <strong>
                                    HP {currentBattlePlayer?.hp ?? 0}/
                                    {currentBattlePlayer?.maxHp ?? 100}
                                </strong>
                            </div>
                        </div>

                        <div className="raid-player-mini-stat">
                            <span>Deaths</span>
                            <strong>{currentBattlePlayer?.deaths ?? 0}</strong>
                        </div>

                        <div className="raid-player-mini-stat">
                            <span>Team</span>
                            <strong>{players.length}</strong>
                        </div>
                    </div>

                    {isBattleIntroActive ? (
                        <div className="raid-intro-dock">
                            <strong>Prepare your input</strong>
                            <span>
                                Watch the lanes. Fight starts after the countdown.
                            </span>
                        </div>
                    ) : announcement ? (
                        <div
                            className={`raid-conclusion-dock ${announcement.toneClassName}`}
                        >
                            <strong>{announcement.title}</strong>
                            <span>{announcement.footer}</span>
                        </div>
                    ) : battle.status === "active" && currentBattlePlayer ? (
                        <div className="raid-input-dock">
                            <BattleControls
                                canSendBattleInput={canSendBattleInput}
                                isInputSending={isInputSending}
                                onBattleInput={onBattleInput}
                            />
                        </div>
                    ) : (
                        <div className="raid-spectator-panel">
                            <strong>{getInactivePlayerTitle(currentBattlePlayer)}</strong>

                            <span>{getInactivePlayerDescription(currentBattlePlayer)}</span>
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}

function getArenaVisibleNotes(notes: BattleNote[], now: number): BattleNote[] {
    if (now <= 0) {
        return [];
    }

    return notes
        .filter((note) => {
            if (note.status !== "pending") {
                return false;
            }

            return (
                note.hitAt >= now - NOTE_LOOK_BEHIND_MS &&
                note.hitAt <= now + NOTE_TRAVEL_MS
            );
        })
        .sort((a, b) => a.hitAt - b.hitAt);
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
            label: "Defeated",
            src: `${basePath}/boss-0.png`
        };
    }

    if (input.bossHpPercent <= 33) {
        return {
            key: "33",
            label: "Enraged",
            src: `${basePath}/boss-33.png`
        };
    }

    if (input.bossHpPercent <= 66) {
        return {
            key: "66",
            label: "Wounded",
            src: `${basePath}/boss-66.png`
        };
    }

    return {
        key: "100",
        label: input.subtitle || "Stable",
        src: `${basePath}/boss-100.png`
    };
}

function getFallingNoteStyle(note: BattleNote, localNow: number): CSSProperties {
    const msUntilHit = note.hitAt - localNow;
    const progress = clamp(1 - msUntilHit / NOTE_TRAVEL_MS, 0, 1.12);
    const noteY = clamp(6 + progress * 86, 6, 94);
    const noteScale = clamp(0.66 + progress * 0.3, 0.66, 1);
    const noteOpacity = clamp(0.28 + progress * 0.68, 0.28, 0.96);

    return {
        "--note-y": `${noteY}%`,
        "--note-scale": `${noteScale}`,
        "--note-opacity": `${noteOpacity}`
    } as CSSProperties;
}

function getResolvedBattleOutcome(
    battle: BattleState
): BattleConclusionOutcome | null {
    if (battle.outcome) {
        return battle.outcome;
    }

    if (battle.status !== "finished") {
        return null;
    }

    return battle.boss.hp <= 0 ? "win" : "lose";
}

function getBattleAnnouncement(
    outcome: BattleConclusionOutcome | null
): BattleAnnouncement | null {
    if (!outcome) {
        return null;
    }

    if (outcome === "win") {
        return {
            kicker: "Raid complete",
            title: "Boss defeated",
            description: "The squad broke the boss before the timer expired.",
            footer: "Preparing battle report...",
            toneClassName: "is-victory"
        };
    }

    return {
        kicker: "Raid failed",
        title: "Squad defeated",
        description: "The boss survived. Your team ran out of HP.",
        footer: "Preparing battle report...",
        toneClassName: "is-defeat"
    };
}

function getBattleOutcomeLabel(input: {
    status: BattleState["status"];
    outcome: BattleConclusionOutcome | null;
    bossHpPercent: number;
}): string {
    if (input.status === "active") {
        return "Live";
    }

    if (input.outcome === "win") {
        return "Victory";
    }

    if (input.outcome === "lose") {
        return "Failed";
    }

    return input.bossHpPercent <= 0 ? "Victory" : "Failed";
}

function getInactivePlayerTitle(
    currentBattlePlayer: BattleState["players"][string] | null
): string {
    if (!currentBattlePlayer) {
        return "Spectator mode";
    }

    if (currentBattlePlayer.hp <= 0) {
        return "You are defeated";
    }

    return "Battle unavailable";
}

function getInactivePlayerDescription(
    currentBattlePlayer: BattleState["players"][string] | null
): string {
    if (!currentBattlePlayer) {
        return "Join the raid before sending battle input.";
    }

    if (currentBattlePlayer.hp <= 0) {
        return "Wait for the final result.";
    }

    return "Battle input is currently disabled.";
}

function getRatingImpactText(damageDealt: number, damageTaken: number): string {
    if (damageDealt > 0) {
        return `+${damageDealt} dmg`;
    }

    if (damageTaken > 0) {
        return `-${damageTaken} HP`;
    }

    return "No damage";
}

function getBattleIntroRemainingMs(input: {
    battle: BattleState;
    localNow: number;
    isBattleConcluded: boolean;
}): number {
    if (input.isBattleConcluded || input.battle.status !== "active") {
        return 0;
    }

    const introEndsAt =
        typeof input.battle.introEndsAt === "number"
            ? input.battle.introEndsAt
            : input.battle.startedAt;

    return Math.max(0, introEndsAt - input.localNow);
}

function getBattleIntroLabel(introRemainingMs: number): string {
    if (introRemainingMs <= 0) {
        return "Fight";
    }

    return String(Math.ceil(introRemainingMs / 1000));
}

function formatBossLevel(level: number): string {
    const safeLevel = Number.isFinite(level) ? level : 1;

    return `Level ${String(safeLevel).padStart(2, "0")}`;
}

function DirectionGlyph({ direction }: { direction: BattleInputKey }) {
    const paths: Record<BattleInputKey, string> = {
        left: "M19 12H5M11 6l-6 6 6 6",
        up: "M12 19V5M6 11l6-6 6 6",
        down: "M12 5v14M6 13l6 6 6-6",
        right: "M5 12h14M13 6l6 6-6 6"
    };

    return (
        <svg
            className="direction-glyph"
            viewBox="0 0 24 24"
            fill="none"
            focusable="false"
            aria-hidden="true"
        >
            <path
                d={paths[direction]}
                stroke="currentColor"
                strokeWidth="2.35"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}