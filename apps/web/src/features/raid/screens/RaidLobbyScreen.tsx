import { BossPanel } from "../components/BossPanel";
import { LobbyActions } from "../components/LobbyActions";
import { PlayerList } from "../components/PlayerList";
import { RaidMetaPanel } from "../components/RaidMetaPanel";
import { formatClock } from "../components/battleUi";
import type { CurrentUser, Raid, RaidPlayer, SocketStatus } from "../types";

type RaidLobbyScreenProps = {
    raid: Raid;
    raidId: string;
    chatId: string | null;
    currentUser: CurrentUser;
    players: RaidPlayer[];
    currentPlayer: RaidPlayer | null;
    canStart: boolean;
    localNow: number;
    socketStatus: SocketStatus;
    socketError: string | null;
    gameError: string | null;
    isJoining: boolean;
    isReadyUpdating: boolean;
    isStarting: boolean;
    onRefresh: () => void;
    onJoin: () => void;
    onReadyChange: (isReady: boolean) => void;
    onStart: () => void;
};

export function RaidLobbyScreen({
                                    raid,
                                    raidId,
                                    chatId,
                                    currentUser,
                                    players,
                                    currentPlayer,
                                    canStart,
                                    localNow,
                                    socketStatus,
                                    socketError,
                                    gameError,
                                    isJoining,
                                    isReadyUpdating,
                                    isStarting,
                                    onRefresh,
                                    onJoin,
                                    onReadyChange,
                                    onStart
                                }: RaidLobbyScreenProps) {
    const expiresIn = formatClock(raid.expiresAt, localNow);
    const isUserInLobby = Boolean(currentPlayer);
    const actionStateLabel = getActionStateLabel({
        isUserInLobby,
        canStart,
        isJoining,
        isReadyUpdating,
        isStarting
    });

    const actionHint = getActionHint({
        isUserInLobby,
        canStart,
        isJoining,
        isReadyUpdating,
        isStarting
    });

    return (
        <main className="raid-prep-page raid-lobby-page">
            <section className="raid-prep-card raid-lobby-card">
                <header className="raid-prep-header">
                    <div>
                        <p className="eyebrow">Telegram Raid Lobby</p>
                        <h1>Boss Raid</h1>
                    </div>

                    <div className="status-pill">{formatStatusLabel(raid.status)}</div>
                </header>

                {gameError && <div className="game-error-banner">{gameError}</div>}

                <section className="raid-lobby-hero" aria-label="Raid preparation">
                    <div className="raid-lobby-hero-copy">
                        <span>Boss 1 / 6</span>
                        <h2>Prepare your squad</h2>
                        <p>
                            Join the lobby, mark yourself ready, then start the raid when
                            the squad is prepared.
                        </p>
                    </div>

                    <div className="raid-lobby-hero-state">
                        <span>State</span>
                        <strong>{formatStatusLabel(raid.status)}</strong>
                    </div>
                </section>

                <section className="raid-lobby-boss-shell" aria-label="Raid boss">
                    <BossPanel battle={raid.battle} raidStatus={raid.status} />
                </section>

                <section className="raid-lobby-status-grid" aria-label="Lobby status">
                    <article className="raid-lobby-status-card">
                        <span>Squad</span>
                        <strong>{players.length}/6</strong>
                    </article>

                    <article className="raid-lobby-status-card">
                        <span>Expires</span>
                        <strong>{expiresIn}</strong>
                    </article>

                    <article className="raid-lobby-status-card">
                        <span>Start</span>
                        <strong>{canStart ? "Ready" : "Locked"}</strong>
                    </article>
                </section>

                <section className="raid-lobby-squad-section">
                    <div className="raid-lobby-section-head">
                        <div>
                            <p className="eyebrow">Squad</p>
                            <h2>Players</h2>
                        </div>

                        <button
                            className="ghost-button raid-lobby-refresh-button"
                            type="button"
                            onClick={onRefresh}
                        >
                            Refresh
                        </button>
                    </div>

                    <PlayerList
                        players={players}
                        battle={raid.battle}
                        currentUserId={currentUser.id}
                        onRefresh={onRefresh}
                    />
                </section>

                <section className="raid-lobby-action-dock">
                    <div className="raid-lobby-action-copy">
                        <span>Your slot</span>
                        <strong>{actionStateLabel}</strong>
                        <p>{actionHint}</p>
                    </div>

                    <LobbyActions
                        currentPlayer={currentPlayer}
                        canStart={canStart}
                        isJoining={isJoining}
                        isReadyUpdating={isReadyUpdating}
                        isStarting={isStarting}
                        onJoin={onJoin}
                        onReadyChange={onReadyChange}
                        onStart={onStart}
                    />
                </section>

                <details className="raid-debug-details">
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

function getActionStateLabel({
                                 isUserInLobby,
                                 canStart,
                                 isJoining,
                                 isReadyUpdating,
                                 isStarting
                             }: {
    isUserInLobby: boolean;
    canStart: boolean;
    isJoining: boolean;
    isReadyUpdating: boolean;
    isStarting: boolean;
}): string {
    if (isStarting) {
        return "Starting";
    }

    if (isJoining) {
        return "Joining";
    }

    if (isReadyUpdating) {
        return "Updating";
    }

    if (canStart) {
        return "Ready to start";
    }

    return isUserInLobby ? "In squad" : "Not joined";
}

function getActionHint({
                           isUserInLobby,
                           canStart,
                           isJoining,
                           isReadyUpdating,
                           isStarting
                       }: {
    isUserInLobby: boolean;
    canStart: boolean;
    isJoining: boolean;
    isReadyUpdating: boolean;
    isStarting: boolean;
}): string {
    if (isStarting) {
        return "Creating battle state and opening the arena.";
    }

    if (isJoining) {
        return "Adding you to the raid squad.";
    }

    if (isReadyUpdating) {
        return "Syncing your ready state with the server.";
    }

    if (canStart) {
        return "The squad is ready. Host can start the raid.";
    }

    if (isUserInLobby) {
        return "Mark yourself ready and wait for the host to start.";
    }

    return "Join the raid to take a player slot.";
}

function formatStatusLabel(status: string): string {
    return status
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}