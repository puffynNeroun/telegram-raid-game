import type { RaidPlayer } from "../types";

type LobbyActionsProps = {
    currentPlayer: RaidPlayer | null;
    canStart: boolean;
    isJoining: boolean;
    isReadyUpdating: boolean;
    isStarting: boolean;
    onJoin: () => void;
    onReadyChange: (isReady: boolean) => void;
    onStart: () => void;
};

export function LobbyActions({
                                 currentPlayer,
                                 canStart,
                                 isJoining,
                                 isReadyUpdating,
                                 isStarting,
                                 onJoin,
                                 onReadyChange,
                                 onStart
                             }: LobbyActionsProps) {
    return (
        <div className="action-stack">
            {!currentPlayer && (
                <button
                    className="primary-button"
                    type="button"
                    disabled={isJoining}
                    onClick={onJoin}
                >
                    {isJoining ? "Joining..." : "Join Lobby"}
                </button>
            )}

            {currentPlayer && (
                <button
                    className="primary-button"
                    type="button"
                    disabled={isReadyUpdating}
                    onClick={() => onReadyChange(!currentPlayer.isReady)}
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
                    onClick={onStart}
                >
                    {isStarting ? "Starting..." : "Start Raid"}
                </button>
            )}

            {currentPlayer?.isHost && !canStart && (
                <p className="hint-text">At least one player must be ready before starting.</p>
            )}

            {!currentPlayer?.isHost && currentPlayer && (
                <p className="hint-text">Waiting for host to start the raid.</p>
            )}
        </div>
    );
}
