import { BossPanel } from "../components/BossPanel";
import { LobbyActions } from "../components/LobbyActions";
import { PlayerList } from "../components/PlayerList";
import { RaidMetaPanel } from "../components/RaidMetaPanel";
import { StatusGrid } from "../components/StatusGrid";
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
    return (
        <main className="app-shell">
            <section className="game-card">
                <header className="game-header">
                    <div>
                        <p className="eyebrow">Telegram Raid Lobby</p>
                        <h1>Boss Raid</h1>
                    </div>

                    <div className="status-pill">{raid.status}</div>
                </header>

                <BossPanel battle={raid.battle} raidStatus={raid.status} />

                <RaidMetaPanel
                    raidId={raidId}
                    chatId={chatId}
                    currentUser={currentUser}
                    socketStatus={socketStatus}
                    socketError={socketError}
                    gameError={gameError}
                />

                {gameError && <div className="game-error-banner">{gameError}</div>}

                <StatusGrid
                    raidStatus={raid.status}
                    playerCount={players.length}
                    timeLabel="Expires"
                    timeValue={formatClock(raid.expiresAt, localNow)}
                />

                <PlayerList
                    players={players}
                    battle={raid.battle}
                    currentUserId={currentUser.id}
                    onRefresh={onRefresh}
                />

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
        </main>
    );
}
