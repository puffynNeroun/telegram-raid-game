import { useEffect, useMemo } from "react";
import { formatTimeLeft } from "./time";
import { getCurrentUser, initTelegramWebApp } from "./telegram";
import { useRaidLobby } from "./useRaidLobby";

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
        isJoining,
        isReadyUpdating,
        isStarting,
        loadRaid,
        joinRaid,
        setReady,
        startRaid
    } = useRaidLobby({
        raidId,
        currentUser
    });

    useEffect(() => {
        initTelegramWebApp();
    }, []);

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
                            <h2>Meme Boss</h2>
                            <span>
                {raid?.status === "battle" ? "Battle started" : "Lobby phase"}
              </span>
                        </div>

                        <div className="hp-bar" aria-label="Boss health">
                            <div className="hp-bar-fill" style={{ width: "100%" }} />
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
                </div>

                {raidState.status === "loading" && (
                    <section className="panel">
                        <h3>Loading raid...</h3>
                        <p className="muted">Fetching lobby state from the API.</p>
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
                                <span>Expires</span>
                                <strong>{formatTimeLeft(raidState.raid.expiresAt, localNow)}</strong>
                            </div>
                        </section>

                        {raidState.raid.status === "battle" && (
                            <section className="panel battle-placeholder">
                                <h3>Battle started</h3>
                                <p className="muted">
                                    The raid moved to battle state. Next step: Socket.IO room sync
                                    and battle prototype.
                                </p>
                            </section>
                        )}

                        <section className="panel">
                            <div className="panel-header">
                                <div>
                                    <h3>Players</h3>
                                    <p className="muted small">Current Redis lobby state.</p>
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
                                {players.map((player) => (
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
                        </span>
                                            </div>
                                        </div>

                                        <strong className={player.isReady ? "ready" : "not-ready"}>
                                            {player.isReady ? "Ready" : "Not ready"}
                                        </strong>
                                    </div>
                                ))}
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