import { BossPanel } from "../components/BossPanel";
import { LobbyActions } from "../components/LobbyActions";
import { PlayerList } from "../components/PlayerList";
import { RaidMetaPanel } from "../components/RaidMetaPanel";
import { formatClock } from "../components/battleUi";
import type {
    BossCatalogItem,
    BossId,
    CurrentUser,
    Raid,
    RaidPlayer,
    SocketStatus
} from "../types";

type RaidLobbyScreenProps = {
    raid: Raid;
    raidId: string;
    chatId: string | null;
    currentUser: CurrentUser;
    players: RaidPlayer[];
    currentPlayer: RaidPlayer | null;
    canStart: boolean;
    bosses: BossCatalogItem[];
    isBossesLoading: boolean;
    bossesError: string | null;
    localNow: number;
    socketStatus: SocketStatus;
    socketError: string | null;
    gameError: string | null;
    isJoining: boolean;
    isReadyUpdating: boolean;
    isBossSelecting: boolean;
    isStarting: boolean;
    onRefresh: () => void;
    onJoin: () => void;
    onReadyChange: (isReady: boolean) => void;
    onSelectBoss: (bossId: BossId) => void;
    onStart: () => void;
};

const FALLBACK_MAX_BOSS_LEVEL = 6;

export function RaidLobbyScreen({
                                    raid,
                                    raidId,
                                    chatId,
                                    currentUser,
                                    players,
                                    currentPlayer,
                                    canStart,
                                    bosses,
                                    isBossesLoading,
                                    bossesError,
                                    localNow,
                                    socketStatus,
                                    socketError,
                                    gameError,
                                    isJoining,
                                    isReadyUpdating,
                                    isBossSelecting,
                                    isStarting,
                                    onRefresh,
                                    onJoin,
                                    onReadyChange,
                                    onSelectBoss,
                                    onStart
                                }: RaidLobbyScreenProps) {
    const expiresIn = formatClock(raid.expiresAt, localNow);
    const selectedBoss = getSelectedBoss({ raid, bosses });
    const bossLevel = selectedBoss?.level ?? getBossLevelFromRaid(raid);
    const maxBossLevel =
        bosses.length > 0 ? bosses.length : FALLBACK_MAX_BOSS_LEVEL;
    const bossProgressLabel = `Boss ${bossLevel} / ${maxBossLevel}`;
    const isUserInLobby = Boolean(currentPlayer);
    const isHost = Boolean(currentPlayer?.isHost);
    const canSelectBoss =
        raid.status === "lobby" && isHost && !isBossSelecting && !isStarting;

    const actionStateLabel = getActionStateLabel({
        isUserInLobby,
        canStart,
        isJoining,
        isReadyUpdating,
        isBossSelecting,
        isStarting
    });

    const actionHint = getActionHint({
        isUserInLobby,
        canStart,
        isJoining,
        isReadyUpdating,
        isBossSelecting,
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

                {bossesError && (
                    <div className="game-error-banner">{bossesError}</div>
                )}

                <section className="raid-lobby-hero" aria-label="Raid preparation">
                    <div className="raid-lobby-hero-copy">
                        <span>{bossProgressLabel}</span>
                        <h2>{getLobbyTitle({ isUserInLobby, canStart })}</h2>
                        <p>{getLobbyDescription({ isUserInLobby, canStart })}</p>
                    </div>

                    <div className="raid-lobby-hero-state">
                        <span>State</span>
                        <strong>{formatStatusLabel(raid.status)}</strong>
                    </div>
                </section>

                <section className="raid-lobby-boss-shell" aria-label="Raid boss">
                    <BossPanel
                        battle={raid.battle}
                        raidStatus={raid.status}
                        bossId={raid.bossId}
                    />
                </section>

                <section
                    className="raid-lobby-boss-selector"
                    aria-label="Boss selection"
                >
                    <div className="raid-lobby-section-head">
                        <div>
                            <p className="eyebrow">Boss selection</p>
                            <h2>Choose raid boss</h2>
                        </div>

                        <div className="raid-lobby-selector-state">
                            {isBossesLoading ? "Loading" : "All unlocked"}
                        </div>
                    </div>

                    <p className="raid-lobby-selector-hint">
                        {getBossSelectorHint({
                            isHost,
                            isBossSelecting,
                            isUserInLobby
                        })}
                    </p>

                    {bosses.length > 0 ? (
                        <div className="raid-lobby-boss-grid">
                            {bosses.map((boss) => {
                                const isSelected = boss.id === raid.bossId;
                                const isDisabled =
                                    !canSelectBoss || isSelected || isBossesLoading;

                                return (
                                    <button
                                        key={boss.id}
                                        className={`raid-lobby-boss-option${
                                            isSelected ? " is-selected" : ""
                                        }`}
                                        type="button"
                                        disabled={isDisabled}
                                        aria-pressed={isSelected}
                                        onClick={() => {
                                            onSelectBoss(boss.id);
                                        }}
                                    >
                                        <span className="raid-lobby-boss-option-level">
                                            {formatBossLevel(boss.level)}
                                        </span>

                                        <span
                                            className="raid-lobby-boss-option-art"
                                            aria-hidden="true"
                                        >
                                            <img
                                                src={getBossIconSrc(boss)}
                                                alt=""
                                                draggable={false}
                                                onError={(event) => {
                                                    const image = event.currentTarget;
                                                    const fallbackSrc =
                                                        getBossFallbackArtSrc(boss);

                                                    if (image.src.endsWith(fallbackSrc)) {
                                                        return;
                                                    }

                                                    image.src = fallbackSrc;
                                                }}
                                            />
                                        </span>

                                        <span className="raid-lobby-boss-option-copy">
                                            <strong>{boss.name}</strong>
                                            <small>{boss.subtitle}</small>
                                        </span>

                                        <span className="raid-lobby-boss-option-meta">
                                            {formatDurationSeconds(boss.durationSeconds)} • HP{" "}
                                            {formatCompactNumber(boss.baseHp)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="raid-lobby-boss-empty">
                            {isBossesLoading
                                ? "Loading boss catalog..."
                                : "Boss catalog is unavailable. Current boss will be used."}
                        </div>
                    )}
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

function getLobbyTitle({
                           isUserInLobby,
                           canStart
                       }: {
    isUserInLobby: boolean;
    canStart: boolean;
}): string {
    if (canStart) {
        return "Squad is ready";
    }

    if (isUserInLobby) {
        return "Prepare your squad";
    }

    return "Join the raid";
}

function getLobbyDescription({
                                 isUserInLobby,
                                 canStart
                             }: {
    isUserInLobby: boolean;
    canStart: boolean;
}): string {
    if (canStart) {
        return "Everyone needed is ready. The host can open the arena and start the boss fight.";
    }

    if (isUserInLobby) {
        return "Pick a boss, mark yourself ready, wait for the squad, then enter the boss fight when the host starts.";
    }

    return "Take a slot in the squad, wait for the host to choose a boss, and prepare for the rhythm battle.";
}

function getBossSelectorHint({
                                 isHost,
                                 isBossSelecting,
                                 isUserInLobby
                             }: {
    isHost: boolean;
    isBossSelecting: boolean;
    isUserInLobby: boolean;
}): string {
    if (isBossSelecting) {
        return "Changing boss and resetting ready state.";
    }

    if (isHost) {
        return "All bosses are available. Changing the boss resets ready state for the squad.";
    }

    if (isUserInLobby) {
        return "Only the host can change the boss. You will see updates here.";
    }

    return "Join the raid first. Host controls boss selection.";
}

function getSelectedBoss(input: {
    raid: Raid;
    bosses: BossCatalogItem[];
}): BossCatalogItem | null {
    return input.bosses.find((boss) => boss.id === input.raid.bossId) ?? null;
}

function getBossLevelFromRaid(raid: Raid): number {
    if (raid.battle?.boss.level) {
        return raid.battle.boss.level;
    }

    return getBossLevelFromBossId(raid.bossId);
}

function getBossLevelFromBossId(bossId: BossId): number {
    const match = bossId.match(/^boss-(\d+)$/);
    const parsedLevel = match ? Number.parseInt(match[1], 10) : 1;

    if (!Number.isFinite(parsedLevel)) {
        return 1;
    }

    return Math.min(Math.max(parsedLevel, 1), FALLBACK_MAX_BOSS_LEVEL);
}

function getBossIconSrc(boss: BossCatalogItem): string {
    return `/raid/${boss.assetSlug}/${formatBossIconFileName(boss.level)}`;
}

function getBossFallbackArtSrc(boss: BossCatalogItem): string {
    return `/raid/${boss.assetSlug}/boss-100.png`;
}

function formatBossIconFileName(level: number): string {
    const safeLevel = Number.isFinite(level) ? level : 1;

    return `${String(safeLevel).padStart(2, "0")}_icon.png`;
}

function formatBossLevel(level: number): string {
    const safeLevel = Number.isFinite(level) ? level : 1;

    return `Level ${String(safeLevel).padStart(2, "0")}`;
}

function formatDurationSeconds(durationSeconds: number): string {
    const safeDuration = Number.isFinite(durationSeconds)
        ? Math.max(0, Math.floor(durationSeconds))
        : 0;

    const minutes = Math.floor(safeDuration / 60);
    const seconds = safeDuration % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatCompactNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return "0";
    }

    if (value >= 1000) {
        return `${Number(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
    }

    return String(value);
}

function getActionStateLabel({
                                 isUserInLobby,
                                 canStart,
                                 isJoining,
                                 isReadyUpdating,
                                 isBossSelecting,
                                 isStarting
                             }: {
    isUserInLobby: boolean;
    canStart: boolean;
    isJoining: boolean;
    isReadyUpdating: boolean;
    isBossSelecting: boolean;
    isStarting: boolean;
}): string {
    if (isStarting) {
        return "Starting";
    }

    if (isBossSelecting) {
        return "Selecting boss";
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
                           isBossSelecting,
                           isStarting
                       }: {
    isUserInLobby: boolean;
    canStart: boolean;
    isJoining: boolean;
    isReadyUpdating: boolean;
    isBossSelecting: boolean;
    isStarting: boolean;
}): string {
    if (isStarting) {
        return "Creating battle state and opening the arena.";
    }

    if (isBossSelecting) {
        return "Changing selected boss and clearing old ready confirmations.";
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
        return "Choose a boss, mark yourself ready, and wait for the host to start.";
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