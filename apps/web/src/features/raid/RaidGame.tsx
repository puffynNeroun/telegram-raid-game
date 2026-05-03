import { useEffect, useMemo } from "react";
import { formatTimeLeft } from "./time";
import { getCurrentUser, initTelegramWebApp } from "./telegram";
import { useRaidLobby } from "./useRaidLobby";
import type { BattleInputKey } from "./types";

const BATTLE_INPUT_CONTROLS: Array<{
    key: BattleInputKey;
    label: string;
    keyboardLabel: string;
}> = [
    {
        key: "left",
        label: "←",
        keyboardLabel: "Left"
    },
    {
        key: "up",
        label: "↑",
        keyboardLabel: "Up"
    },
    {
        key: "down",
        label: "↓",
        keyboardLabel: "Down"
    },
    {
        key: "right",
        label: "→",
        keyboardLabel: "Right"
    }
];

export function RaidGame() {
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const raidId = params.get("raidId");
    const chatId = params.get("chatId");

    const currentUser = useMemo(() => getCurrentUser(params), [params]);

    const {
        raidState,
        raid,
        players,
        currentPlayer,
        canStart,
        localNow,
        socketStatus,
        socketError,
        isJoining,
        isReadyUpdating,
        isStarting,
        isInputSending,
        loadRaid,
        joinRaid,
        setReady,
        startRaid,
        sendBattleInput
    } = useRaidLobby({
        raidId,
        currentUser
    });

    const battle = raid?.battle ?? null;
    const currentBattlePlayer = battle?.players[currentUser.id] ?? null;

    const bossHpPercent = battle
        ? getBossHpPercent(battle.boss.hp, battle.boss.maxHp)
        : 100;

    const battleTimeLeft = battle
        ? formatTimeLeft(battle.endsAt, localNow)
        : null;

    const canSendBattleInput = Boolean(
        battle?.status === "active" && currentBattlePlayer
    );

    useEffect(() => {
        initTelegramWebApp();
    }, []);

    useEffect(() => {
        if (!canSendBattleInput) {
            return;
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.repeat) {
                return;
            }

            const inputKey = getBattleInputKeyFromKeyboard(event.key);

            if (!inputKey) {
                return;
            }

            event.preventDefault();
            sendBattleInput(inputKey);
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [canSendBattleInput, sendBattleInput]);

    if (!raidId) {
        return (
            <main className="app-shell">
                <section className="game-card">
                    <p className="eyebrow">Raid Boss</p>
                    <h1>No raid selected</h1>

                    <p className="muted">
                        Open the app from the Telegram Join Raid link, or add a raidId to the URL.
                    </p>

                    <div className="debug-panel">
                        <span>Expected URL format:</span>
                        <code>/?raidId=abc123&amp;chatId=-100...</code>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="app-shell">
            <section className="game-card">
                <header className="game-header">
                    <div>
                        <p className="eyebrow">Telegram Raid Lobby</p>
                        <h1>Boss Raid</h1>
                    </div>

                    <div className="status-pill">
                        {raidState.status === "loaded" ? raidState.raid.status : "Loading"}
                    </div>
                </header>

                <section className="boss-panel">
                    <div className="boss-art">👹</div>

                    <div className="boss-info">
                        <div className="boss-row">
                            <h2>{battle?.boss.name ?? "Meme Boss"}</h2>

                            <span>
                {battle
                    ? `${battle.boss.hp}/${battle.boss.maxHp} HP`
                    : raid?.status === "battle"
                        ? "Battle started"
                        : "Lobby phase"}
              </span>
                        </div>

                        <div className="hp-bar" aria-label="Boss health">
                            <div className="hp-bar-fill" style={{ width: `${bossHpPercent}%` }} />
                        </div>
                    </div>
                </section>

                <div className="raid-meta">
                    <p>
                        Raid ID: <span>{raidId}</span>
                    </p>

                    {chatId && (
                        <p>
                            Chat ID: <span>{chatId}</span>
                        </p>
                    )}

                    <p>
                        You: <span>{currentUser.displayName}</span>
                    </p>

                    <p>
                        User source: <span>{currentUser.source}</span>
                    </p>

                    <p>
                        Realtime: <span>{socketStatus}</span>
                    </p>

                    {socketError && (
                        <p>
                            Socket error: <span>{socketError}</span>
                        </p>
                    )}
                </div>

                {raidState.status === "loading" && (
                    <section className="panel">
                        <h3>Loading raid...</h3>
                        <p className="muted">Fetching raid state from the API.</p>
                    </section>
                )}

                {raidState.status === "error" && (
                    <section className="panel danger-panel">
                        <h3>Raid error</h3>
                        <p>{raidState.message}</p>
                    </section>
                )}

                {raidState.status === "loaded" && (
                    <>
                        <section className="status-grid">
                            <div className="status-box">
                                <span>Status</span>
                                <strong>{raidState.raid.status}</strong>
                            </div>

                            <div className="status-box">
                                <span>Players</span>
                                <strong>{players.length}/6</strong>
                            </div>

                            <div className="status-box">
                                <span>{battle ? getBattleTimeLabel(battle.status) : "Expires"}</span>
                                <strong>
                                    {battle
                                        ? battleTimeLeft
                                        : formatTimeLeft(raidState.raid.expiresAt, localNow)}
                                </strong>
                            </div>
                        </section>

                        {battle && (
                            <section
                                className={getBattlePanelClassName(
                                    battle.status,
                                    battle.outcome
                                )}
                            >
                                <div className="battle-header">
                                    <div>
                                        <h3>{getBattleTitle(battle.status, battle.outcome)}</h3>

                                        <p className="muted small">
                                            {getBattleDescription(battle.status, battle.outcome)}
                                        </p>
                                    </div>

                                    <strong
                                        className={getBattleTimerClassName(
                                            battle.status,
                                            battle.outcome
                                        )}
                                    >
                                        {battleTimeLeft}
                                    </strong>
                                </div>

                                <div className="battle-stats-grid">
                                    <div className="battle-stat">
                                        <span>Boss HP</span>
                                        <strong>
                                            {battle.boss.hp}/{battle.boss.maxHp}
                                        </strong>
                                    </div>

                                    <div className="battle-stat">
                                        <span>Phase</span>
                                        <strong>{battle.boss.phase}</strong>
                                    </div>

                                    <div className="battle-stat">
                                        <span>Outcome</span>
                                        <strong>{battle.outcome ?? "pending"}</strong>
                                    </div>
                                </div>

                                {battle.status === "active" && (
                                    <div className="battle-actions">
                                        {currentBattlePlayer ? (
                                            <>
                                                <div className="input-pad" aria-label="Battle input controls">
                                                    {BATTLE_INPUT_CONTROLS.map((control) => (
                                                        <button
                                                            className={`input-button input-button-${control.key}`}
                                                            key={control.key}
                                                            type="button"
                                                            disabled={!canSendBattleInput}
                                                            onClick={() => sendBattleInput(control.key)}
                                                            aria-label={`Send ${control.keyboardLabel} input`}
                                                        >
                              <span className="input-button-symbol">
                                {control.label}
                              </span>
                                                            <span className="input-button-label">
                                {control.keyboardLabel}
                              </span>
                                                        </button>
                                                    ))}
                                                </div>

                                                <p className="hint-text input-hint">
                                                    {isInputSending
                                                        ? "Syncing input with server..."
                                                        : "Tap arrows on mobile or use keyboard arrows on desktop."}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="hint-text">
                                                Join the raid before sending battle input.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </section>
                        )}

                        <section className="panel">
                            <div className="panel-header">
                                <div>
                                    <h3>Players</h3>

                                    <p className="muted small">
                                        {battle ? "Battle player state." : "Realtime Redis lobby state."}
                                    </p>
                                </div>

                                <button
                                    className="ghost-button"
                                    type="button"
                                    onClick={() => loadRaid(raidId)}
                                >
                                    Refresh
                                </button>
                            </div>

                            <div className="player-list">
                                {players.map((player) => {
                                    const battlePlayer = battle?.players[player.telegramUserId];

                                    return (
                                        <div className="player-row" key={player.telegramUserId}>
                                            <div className="player-main">
                        <span className="avatar">
                          {player.isHost ? "👑" : "⚔️"}
                        </span>

                                                <div>
                                                    <strong>{player.displayName}</strong>

                                                    <span>
                            {player.isHost ? "Host" : "Player"}
                                                        {player.telegramUserId === currentUser.id ? " · You" : ""}
                                                        {battlePlayer
                                                            ? ` · HP ${battlePlayer.hp}/${battlePlayer.maxHp}`
                                                            : ""}
                          </span>
                                                </div>
                                            </div>

                                            <strong
                                                className={
                                                    battlePlayer ? "ready" : player.isReady ? "ready" : "not-ready"
                                                }
                                            >
                                                {battlePlayer
                                                    ? `${battlePlayer.damage} dmg`
                                                    : player.isReady
                                                        ? "Ready"
                                                        : "Not ready"}
                                            </strong>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {raidState.raid.status === "lobby" && (
                            <div className="action-stack">
                                {!currentPlayer && (
                                    <button
                                        className="primary-button"
                                        type="button"
                                        disabled={isJoining}
                                        onClick={joinRaid}
                                    >
                                        {isJoining ? "Joining..." : "Join Lobby"}
                                    </button>
                                )}

                                {currentPlayer && (
                                    <button
                                        className="primary-button"
                                        type="button"
                                        disabled={isReadyUpdating}
                                        onClick={() => setReady(!currentPlayer.isReady)}
                                    >
                                        {isReadyUpdating
                                            ? "Updating..."
                                            : currentPlayer.isReady
                                                ? "Unready"
                                                : "Ready"}
                                    </button>
                                )}

                                {currentPlayer?.isHost && (
                                    <button
                                        className="secondary-button"
                                        type="button"
                                        disabled={!canStart || isStarting}
                                        onClick={startRaid}
                                    >
                                        {isStarting ? "Starting..." : "Start Raid"}
                                    </button>
                                )}

                                {currentPlayer?.isHost && !canStart && (
                                    <p className="hint-text">
                                        At least one player must be ready before starting.
                                    </p>
                                )}

                                {!currentPlayer?.isHost && currentPlayer && (
                                    <p className="hint-text">Waiting for host to start the raid.</p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </section>
        </main>
    );
}

function getBattleInputKeyFromKeyboard(key: string): BattleInputKey | null {
    if (key === "ArrowLeft" || key.toLowerCase() === "a") {
        return "left";
    }

    if (key === "ArrowUp" || key.toLowerCase() === "w") {
        return "up";
    }

    if (key === "ArrowDown" || key.toLowerCase() === "s") {
        return "down";
    }

    if (key === "ArrowRight" || key.toLowerCase() === "d") {
        return "right";
    }

    return null;
}

function getBossHpPercent(currentHp: number, maxHp: number): number {
    if (maxHp <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
}

function getBattleTimeLabel(status: "active" | "finished"): string {
    return status === "finished" ? "Battle ended" : "Battle ends";
}

function getBattlePanelClassName(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    return `panel battle-panel ${getBattleStateClassName(status, outcome)}`;
}

function getBattleTimerClassName(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    return `battle-timer ${getBattleStateClassName(status, outcome)}`;
}

function getBattleStateClassName(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    if (status !== "finished") {
        return "";
    }

    if (outcome === "win") {
        return "is-win";
    }

    if (outcome === "lose") {
        return "is-lose";
    }

    return "is-finished";
}

function getBattleTitle(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    if (status === "active") {
        return "Battle active";
    }

    if (outcome === "win") {
        return "Boss defeated";
    }

    if (outcome === "lose") {
        return "Raid failed";
    }

    return "Battle finished";
}

function getBattleDescription(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    if (status === "active") {
        return "Use the four battle inputs to damage the boss.";
    }

    if (outcome === "win") {
        return "The team defeated the boss before the timer expired.";
    }

    if (outcome === "lose") {
        return "The timer expired before the boss was defeated.";
    }

    return "The battle has ended.";
}