import { BattleSummary } from "../components/BattleSummary";
import { BossPanel } from "../components/BossPanel";
import { PlayerList } from "../components/PlayerList";
import { RaidMetaPanel } from "../components/RaidMetaPanel";
import { StatusGrid } from "../components/StatusGrid";
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
    const battleTimeLeft = formatClock(battle.endsAt, localNow);

    return (
        <main className="app-shell">
            <section className="game-card">
                <header className="game-header">
                    <div>
                        <p className="eyebrow">Telegram Raid Result</p>
                        <h1>Boss Raid</h1>
                    </div>

                    <div className="status-pill">{raid.status}</div>
                </header>

                <BossPanel battle={battle} raidStatus={raid.status} />

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
                    timeLabel={getBattleTimeLabel(battle.status)}
                    timeValue={battleTimeLeft}
                />

                <BattleSummary battle={battle} battleTimeLeft={battleTimeLeft} />

                <PlayerList
                    players={players}
                    battle={battle}
                    currentUserId={currentUser.id}
                    onRefresh={onRefresh}
                />
            </section>
        </main>
    );
}
