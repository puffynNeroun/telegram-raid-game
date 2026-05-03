import { useMemo } from "react";
import { BattleControls } from "../components/BattleControls";
import { BattleSummary } from "../components/BattleSummary";
import { BossPanel } from "../components/BossPanel";
import { CombatStats } from "../components/CombatStats";
import { CurrentNoteTarget } from "../components/CurrentNoteTarget";
import { PlayerList } from "../components/PlayerList";
import { RaidMetaPanel } from "../components/RaidMetaPanel";
import { StatusGrid } from "../components/StatusGrid";
import { UpcomingNotes } from "../components/UpcomingNotes";
import {
    formatClock,
    getBattleTimeLabel,
    getCurrentTargetNote,
    getVisibleNotes
} from "../components/battleUi";
import type {
    BattleInputKey,
    BattleState,
    CurrentUser,
    Raid,
    RaidPlayer,
    SocketStatus
} from "../types";

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

export function RaidBattleScreen({
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
                                     isInputSending,
                                     onRefresh,
                                     onBattleInput
                                 }: RaidBattleScreenProps) {
    const currentBattlePlayer = battle.players[currentUser.id] ?? null;
    const currentPlayerNotes = battle.notesByPlayer[currentUser.id] ?? [];

    const visibleNotes = useMemo(() => {
        return getVisibleNotes(currentPlayerNotes, localNow);
    }, [currentPlayerNotes, localNow]);

    const currentTargetNote = useMemo(() => {
        return getCurrentTargetNote(currentPlayerNotes, localNow);
    }, [currentPlayerNotes, localNow]);

    const battleTimeLeft = formatClock(battle.endsAt, localNow);

    const isCurrentPlayerStunned = Boolean(
        currentBattlePlayer &&
        currentBattlePlayer.isStunned &&
        currentBattlePlayer.stunnedUntil &&
        currentBattlePlayer.stunnedUntil > localNow
    );

    const canSendBattleInput = Boolean(
        battle.status === "active" &&
        currentBattlePlayer &&
        !isCurrentPlayerStunned
    );

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

                <BattleSummary battle={battle} battleTimeLeft={battleTimeLeft}>
                    {currentBattlePlayer && (
                        <CombatStats
                            player={currentBattlePlayer}
                            isStunned={isCurrentPlayerStunned}
                            localNow={localNow}
                        />
                    )}

                    {battle.status === "active" && (
                        <div className="battle-actions">
                            {currentBattlePlayer ? (
                                <>
                                    <CurrentNoteTarget note={currentTargetNote} localNow={localNow} />

                                    <UpcomingNotes
                                        notes={visibleNotes}
                                        currentTargetNote={currentTargetNote}
                                        localNow={localNow}
                                    />

                                    <BattleControls
                                        canSendBattleInput={canSendBattleInput}
                                        isInputSending={isInputSending}
                                        onBattleInput={onBattleInput}
                                    />
                                </>
                            ) : (
                                <p className="hint-text">
                                    Join the raid before sending battle input.
                                </p>
                            )}
                        </div>
                    )}
                </BattleSummary>

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
