import { useEffect, useMemo, useState } from "react";

type RaidPlayer = {
    telegramUserId: string;
    displayName: string;
    isHost: boolean;
    isReady: boolean;
    joinedAt: number;
};

type Raid = {
    id: string;
    telegramChatId: string;
    hostTelegramUserId: string;
    hostDisplayName: string;
    status: "lobby" | "cancelled" | "battle" | "finished";
    createdAt: number;
    expiresAt: number;
    players: Record<string, RaidPlayer>;
};

type RaidState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "loaded"; raid: Raid; serverTime: number }
    | { status: "error"; message: string };

type TelegramUser = {
    id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
};

type CurrentUser = {
    id: string;
    displayName: string;
    source: "telegram" | "dev" | "local";
};

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function RaidGame() {
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const raidId = params.get("raidId");
    const chatId = params.get("chatId");

    const currentUser = useMemo(() => getCurrentUser(params), [params]);

    const [raidState, setRaidState] = useState<RaidState>({ status: "idle" });
    const [isJoining, setIsJoining] = useState(false);
    const [isReadyUpdating, setIsReadyUpdating] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [localNow, setLocalNow] = useState(Date.now());

    const raid = raidState.status === "loaded" ? raidState.raid : null;
    const currentPlayer = raid?.players[currentUser.id] ?? null;
    const players = raid ? Object.values(raid.players) : [];
    const readyPlayersCount = players.filter((player) => player.isReady).length;

    const canStart = Boolean(
        raid?.status === "lobby" && currentPlayer?.isHost && readyPlayersCount >= 1
    );

    useEffect(() => {
        window.Telegram?.WebApp?.ready?.();
        window.Telegram?.WebApp?.expand?.();
    }, []);

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setLocalNow(Date.now());
        }, 1000);

        return () => {
            window.clearInterval(timerId);
        };
    }, []);

    useEffect(() => {
        if (!raidId) {
            return;
        }

        void loadRaid(raidId);
    }, [raidId]);

    async function loadRaid(nextRaidId: string) {
        setRaidState({ status: "loading" });

        try {
            const response = await fetch(`${apiUrl}/raids/${nextRaidId}`);
            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.error ?? `API returned ${response.status}`);
            }

            setRaidState({
                status: "loaded",
                raid: data.raid as Raid,
                serverTime: Number(data.serverTime)
            });
        } catch (error) {
            setRaidState({
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    }

    async function joinRaid() {
        if (!raidId) {
            return;
        }

        setIsJoining(true);

        try {
            const response = await fetch(`${apiUrl}/raids/${raidId}/join`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    telegramUserId: currentUser.id,
                    displayName: currentUser.displayName
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.error ?? `API returned ${response.status}`);
            }

            setRaidState({
                status: "loaded",
                raid: data.raid as Raid,
                serverTime: Date.now()
            });
        } catch (error) {
            setRaidState({
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        } finally {
            setIsJoining(false);
        }
    }

    async function setReady(isReady: boolean) {
        if (!raidId) {
            return;
        }

        setIsReadyUpdating(true);

        try {
            const response = await fetch(`${apiUrl}/raids/${raidId}/ready`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    telegramUserId: currentUser.id,
                    isReady
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.error ?? `API returned ${response.status}`);
            }

            setRaidState({
                status: "loaded",
                raid: data.raid as Raid,
                serverTime: Date.now()
            });
        } catch (error) {
            setRaidState({
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        } finally {
            setIsReadyUpdating(false);
        }
    }

    async function startRaid() {
        if (!raidId) {
            return;
        }

        setIsStarting(true);

        try {
            const response = await fetch(`${apiUrl}/raids/${raidId}/start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    telegramUserId: currentUser.id
                })
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.error ?? `API returned ${response.status}`);
            }

            setRaidState({
                status: "loaded",
                raid: data.raid as Raid,
                serverTime: Date.now()
            });
        } catch (error) {
            setRaidState({
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        } finally {
            setIsStarting(false);
        }
    }

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

function formatTimeLeft(expiresAt: number, now: number): string {
    const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    const minutes = Math.floor(seconds / 60);
    const restSeconds = seconds % 60;

    return `${minutes}:${String(restSeconds).padStart(2, "0")}`;
}

function getCurrentUser(params: URLSearchParams): CurrentUser {
    const devUserId = params.get("devUserId");
    const devName = params.get("devName");

    if (devUserId && devName) {
        return {
            id: devUserId,
            displayName: devName,
            source: "dev"
        };
    }

    const telegramUser = getTelegramUser();
    const telegramDisplayName = getTelegramDisplayName(telegramUser);

    if (telegramUser?.id && telegramDisplayName) {
        return {
            id: String(telegramUser.id),
            displayName: telegramDisplayName,
            source: "telegram"
        };
    }

    const fallbackUser = getOrCreateFallbackUser();

    return {
        id: fallbackUser.id,
        displayName: fallbackUser.displayName,
        source: "local"
    };
}

function getTelegramUser(): TelegramUser | null {
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

function getTelegramDisplayName(user: TelegramUser | null): string | null {
    if (!user) {
        return null;
    }

    if (user.username) {
        return `@${user.username}`;
    }

    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

    return fullName || null;
}

function getOrCreateFallbackUser() {
    const storageKey = "raid-game-debug-user";
    const existing = window.localStorage.getItem(storageKey);

    if (existing) {
        return JSON.parse(existing) as { id: string; displayName: string };
    }

    const user = {
        id: `debug_${crypto.randomUUID()}`,
        displayName: "Local Player"
    };

    window.localStorage.setItem(storageKey, JSON.stringify(user));

    return user;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp?: {
                initData?: string;
                initDataUnsafe?: {
                    user?: TelegramUser;
                };
                ready?: () => void;
                expand?: () => void;
            };
        };
    }
}