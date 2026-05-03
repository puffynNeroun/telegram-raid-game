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
    onRefresh: () => void;
};

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
                                     onRefresh
                                 }: RaidResultScreenProps) {
    const battleTimeValue = formatClock(battle.endsAt, localNow);
    const battleTimeLabel = getBattleTimeLabel(battle.status);

    const bossHp = Math.max(0, battle.boss.hp);
    const bossMaxHp = Math.max(1, battle.boss.maxHp);
    const bossHpPercent = Math.round((bossHp / bossMaxHp) * 100);

    const isVictory = bossHp <= 0;
    const resultToneClassName = isVictory ? "is-win" : "is-lose";
    const outcomeLabel = isVictory ? "Victory" : "Failed";
    const outcomeTitle = isVictory ? "Boss defeated" : "Raid failed";
    const outcomeDescription = isVictory
        ? "The squad defeated the boss before the raid expired."
        : "The boss survived. Upgrade timing, coordination, and damage output.";

    const teamDamage = Math.max(0, battle.boss.maxHp - battle.boss.hp);
    const battlePlayerStates = Object.values(battle.players);

    const bestCombo = battlePlayerStates.reduce((bestComboValue, player) => {
        return Math.max(bestComboValue, player.maxCombo);
    }, 0);

    const totalDeaths = battlePlayerStates.reduce((deathCount, player) => {
        return deathCount + player.deaths;
    }, 0);

    const survivors = battlePlayerStates.filter((player) => player.hp > 0).length;

    return (
        <main className="raid-prep-page raid-result-page">
            <section className={`raid-prep-card raid-result-card ${resultToneClassName}`}>
                <header className="raid-prep-header raid-result-header">
                    <div>
                        <p className="eyebrow">Telegram Raid Result</p>
                        <h1>Boss Raid</h1>
                    </div>

                    <div className={`status-pill raid-result-pill ${resultToneClassName}`}>
                        {outcomeLabel}
                    </div>
                </header>

                {gameError && <div className="game-error-banner">{gameError}</div>}

                <section
                    className={`raid-result-hero ${resultToneClassName}`}
                    aria-label="Raid result summary"
                >
                    <div className="raid-result-emblem" aria-hidden="true">
                        <span>{isVictory ? "🏆" : "💀"}</span>
                    </div>

                    <div className="raid-result-hero-copy">
                        <span>{formatStatusLabel(raid.status)}</span>
                        <h2>{outcomeTitle}</h2>
                        <p>{outcomeDescription}</p>
                    </div>

                    <div className="raid-result-time-badge">
                        <span>{battleTimeLabel}</span>
                        <strong>{battleTimeValue}</strong>
                    </div>
                </section>

                <section className="raid-result-boss-shell" aria-label="Final boss state">
                    <BossPanel battle={battle} raidStatus={raid.status} />
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
                            <strong>{getBossPhaseLabel(isVictory, bossHpPercent)}</strong>
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

                <section className="raid-result-players-section">
                    <div className="raid-result-section-head">
                        <div>
                            <p className="eyebrow">Squad</p>
                            <h2>Players</h2>
                        </div>

                        <button
                            className="ghost-button raid-result-refresh-button"
                            type="button"
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

function getBossPhaseLabel(isVictory: boolean, bossHpPercent: number): string {
    if (isVictory) {
        return "Defeated";
    }

    if (bossHpPercent <= 33) {
        return "Enraged";
    }

    if (bossHpPercent <= 66) {
        return "Wounded";
    }

    return "Stable";
}

function formatStatusLabel(status: string): string {
    return status
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}