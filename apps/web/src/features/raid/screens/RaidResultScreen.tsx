import { BossPanel } from "../components/BossPanel";
import { PlayerList } from "../components/PlayerList";
import { RaidMetaPanel } from "../components/RaidMetaPanel";
import { formatClock, getBattleTimeLabel } from "../components/battleUi";
import type { BattleState, CurrentUser, Raid, RaidPlayer, SocketStatus } from "../types";

type RaidResultScreenProps = {
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
    isCreatingRaid: boolean;
    raidActionError: string | null;
    onRefresh: () => void;
    onRetryBoss: () => void;
    onCreateNewRaid: () => void;
};

type BattleResultOutcome = Exclude<BattleState["outcome"], null>;

export function RaidResultScreen({
                                     raid,
                                     battle,
                                     raidId,
                                     chatId,
                                     currentUser,
                                     players,
                                     localNow,
                                     socketStatus,
                                     socketError,
                                     gameError,
                                     isCreatingRaid,
                                     raidActionError,
                                     onRefresh,
                                     onRetryBoss,
                                     onCreateNewRaid
                                 }: RaidResultScreenProps) {
    const outcome = getResolvedOutcome(battle);
    const isVictory = outcome === "win";

    const battleTimeLabel =
        battle.status === "finished" ? "Duration" : getBattleTimeLabel(battle.status);

    const battleTimeValue =
        battle.status === "finished"
            ? formatBattleDuration({
                startedAt: battle.startedAt,
                finishedAt: battle.endsAt
            })
            : formatClock(battle.endsAt, localNow);

    const bossHp = Math.max(0, battle.boss.hp);
    const bossMaxHp = Math.max(1, battle.boss.maxHp);
    const bossHpPercent = Math.round((bossHp / bossMaxHp) * 100);

    const resultToneClassName = isVictory ? "is-win" : "is-lose";
    const outcomeLabel = isVictory ? "Victory" : "Failed";
    const outcomeTitle = isVictory ? "Boss defeated" : "Raid failed";
    const primaryActionLabel = isVictory ? "Run again" : "Retry boss";
    const outcomeDescription = getOutcomeDescription({
        outcome,
        bossName: battle.boss.name
    });

    const teamDamage = Math.max(0, battle.boss.maxHp - battle.boss.hp);
    const battlePlayerStates = Object.values(battle.players);

    const bestCombo = battlePlayerStates.reduce((bestComboValue, player) => {
        return Math.max(bestComboValue, player.maxCombo);
    }, 0);

    const totalDeaths = battlePlayerStates.reduce((deathCount, player) => {
        return deathCount + player.deaths;
    }, 0);

    const survivors = battlePlayerStates.filter((player) => player.hp > 0).length;

    const totalPerfectHits = battlePlayerStates.reduce((hitCount, player) => {
        return hitCount + player.perfectCount;
    }, 0);

    const totalGoodHits = battlePlayerStates.reduce((hitCount, player) => {
        return hitCount + player.goodCount;
    }, 0);

    const totalMisses = battlePlayerStates.reduce((missCount, player) => {
        return missCount + player.missCount + player.wrongCount;
    }, 0);

    return (
        <main className="raid-prep-page raid-result-page">
            <section className={`raid-prep-card raid-result-card ${resultToneClassName}`}>
                <header className="raid-prep-header raid-result-header">
                    <div>
                        <p className="eyebrow">Telegram Raid Result</p>
                        <h1>{battle.boss.name}</h1>
                    </div>

                    <div className={`status-pill raid-result-pill ${resultToneClassName}`}>
                        {outcomeLabel}
                    </div>
                </header>

                {gameError && <div className="game-error-banner">{gameError}</div>}

                {raidActionError && (
                    <div className="game-error-banner">{raidActionError}</div>
                )}

                <section
                    className={`raid-result-hero ${resultToneClassName}`}
                    aria-label="Raid result summary"
                >
                    <div className="raid-result-emblem" aria-hidden="true">
                        <span>{isVictory ? "🏆" : "💀"}</span>
                    </div>

                    <div className="raid-result-hero-copy">
                        <span>
                            {formatBossLevel(battle.boss.level)} • {battle.boss.subtitle}
                        </span>

                        <h2>{outcomeTitle}</h2>

                        <p>{outcomeDescription}</p>
                    </div>

                    <div className="raid-result-time-badge">
                        <span>{battleTimeLabel}</span>
                        <strong>{battleTimeValue}</strong>
                    </div>
                </section>

                <section className="raid-result-actions" aria-label="Raid result actions">
                    <div className="raid-result-actions-copy">
                        <p className="eyebrow">Next action</p>
                        <h2>Choose the next raid step</h2>
                        <p>
                            Start another lobby from this result screen instead of going
                            back to the Telegram group manually.
                        </p>
                    </div>

                    <div className="raid-result-actions-grid">
                        <button
                            className="raid-result-action-button raid-result-primary-action"
                            type="button"
                            disabled={isCreatingRaid}
                            onClick={onRetryBoss}
                        >
                            <span>{isCreatingRaid ? "Creating..." : primaryActionLabel}</span>
                            <small>Same boss, fresh lobby</small>
                        </button>

                        <button
                            className="raid-result-action-button raid-result-secondary-action"
                            type="button"
                            disabled={isCreatingRaid}
                            onClick={onCreateNewRaid}
                        >
                            <span>{isCreatingRaid ? "Creating..." : "New raid"}</span>
                            <small>Create a new lobby</small>
                        </button>

                        <button
                            className="raid-result-action-button raid-result-disabled-action"
                            type="button"
                            disabled
                            title="Boss progression will be added after the core loop is stable."
                        >
                            <span>Next boss</span>
                            <small>Progression locked</small>
                        </button>

                        <button
                            className="raid-result-action-button raid-result-secondary-action"
                            type="button"
                            disabled={isCreatingRaid}
                            onClick={onRefresh}
                        >
                            <span>Refresh</span>
                            <small>Reload current result</small>
                        </button>
                    </div>
                </section>

                <section className="raid-result-boss-shell" aria-label="Final boss state">
                    <BossPanel
                        battle={battle}
                        raidStatus={raid.status}
                        bossId={raid.bossId}
                    />
                </section>

                <section className="raid-result-summary-grid" aria-label="Raid summary">
                    <article className="raid-result-summary-card">
                        <span>Total damage</span>
                        <strong>{teamDamage}</strong>
                    </article>

                    <article className="raid-result-summary-card">
                        <span>Players</span>
                        <strong>{players.length}/6</strong>
                    </article>

                    <article className="raid-result-summary-card">
                        <span>Best combo</span>
                        <strong>{bestCombo}</strong>
                    </article>
                </section>

                <section className="raid-result-breakdown">
                    <div className="raid-result-section-head">
                        <div>
                            <p className="eyebrow">Battle report</p>
                            <h2>Final state</h2>
                        </div>
                    </div>

                    <div className="raid-result-breakdown-grid">
                        <article>
                            <span>Boss HP</span>
                            <strong>
                                {bossHp}/{battle.boss.maxHp}
                            </strong>
                        </article>

                        <article>
                            <span>Boss phase</span>
                            <strong>{getBossPhaseLabel({ battle, outcome, bossHpPercent })}</strong>
                        </article>

                        <article>
                            <span>Outcome</span>
                            <strong>{outcomeLabel}</strong>
                        </article>

                        <article>
                            <span>Survivors</span>
                            <strong>{survivors}</strong>
                        </article>

                        <article>
                            <span>Deaths</span>
                            <strong>{totalDeaths}</strong>
                        </article>

                        <article>
                            <span>Raid status</span>
                            <strong>{formatStatusLabel(raid.status)}</strong>
                        </article>
                    </div>
                </section>

                <section className="raid-result-breakdown">
                    <div className="raid-result-section-head">
                        <div>
                            <p className="eyebrow">Execution</p>
                            <h2>Timing stats</h2>
                        </div>
                    </div>

                    <div className="raid-result-breakdown-grid">
                        <article>
                            <span>Perfect</span>
                            <strong>{totalPerfectHits}</strong>
                        </article>

                        <article>
                            <span>Good</span>
                            <strong>{totalGoodHits}</strong>
                        </article>

                        <article>
                            <span>Miss / wrong</span>
                            <strong>{totalMisses}</strong>
                        </article>
                    </div>
                </section>

                <section className="raid-result-players-section">
                    <div className="raid-result-section-head">
                        <div>
                            <p className="eyebrow">Squad</p>
                            <h2>Players</h2>
                        </div>

                        <button
                            className="ghost-button raid-result-refresh-button"
                            type="button"
                            disabled={isCreatingRaid}
                            onClick={onRefresh}
                        >
                            Refresh
                        </button>
                    </div>

                    <PlayerList
                        players={players}
                        battle={battle}
                        currentUserId={currentUser.id}
                        onRefresh={onRefresh}
                    />
                </section>

                <details className="raid-debug-details raid-result-debug">
                    <summary>Connection details</summary>

                    <RaidMetaPanel
                        raidId={raidId}
                        chatId={chatId}
                        currentUser={currentUser}
                        socketStatus={socketStatus}
                        socketError={socketError}
                        gameError={gameError}
                    />
                </details>
            </section>
        </main>
    );
}

function getResolvedOutcome(battle: BattleState): BattleResultOutcome {
    if (battle.outcome) {
        return battle.outcome;
    }

    return battle.boss.hp <= 0 ? "win" : "lose";
}

function getOutcomeDescription(input: {
    outcome: BattleResultOutcome;
    bossName: string;
}): string {
    if (input.outcome === "win") {
        return `The squad defeated ${input.bossName} before the raid expired.`;
    }

    return `${input.bossName} survived. Improve timing, coordination, and damage output.`;
}

function getBossPhaseLabel(input: {
    battle: BattleState;
    outcome: BattleResultOutcome;
    bossHpPercent: number;
}): string {
    if (input.outcome === "win") {
        return "Defeated";
    }

    if (input.outcome === "lose" && input.battle.boss.hp > 0) {
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
            break;
    }

    if (input.bossHpPercent <= 33) {
        return "Enraged";
    }

    if (input.bossHpPercent <= 66) {
        return "Wounded";
    }

    return "Stable";
}

function formatBossLevel(level: number): string {
    const safeLevel = Number.isFinite(level) ? level : 1;

    return `Level ${String(safeLevel).padStart(2, "0")}`;
}

function formatBattleDuration(input: {
    startedAt: number;
    finishedAt: number;
}): string {
    const durationMs = Math.max(0, input.finishedAt - input.startedAt);
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatStatusLabel(status: string): string {
    return status
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}