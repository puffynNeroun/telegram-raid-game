import type { BattleState, RaidPlayer } from "../types";

type PlayerListProps = {
    players: RaidPlayer[];
    battle: BattleState | null;
    currentUserId: string;
    onRefresh: () => void;
};

export function PlayerList({ players, battle, currentUserId, onRefresh }: PlayerListProps) {
    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <h3>Players</h3>

                    <p className="muted small">
                        {battle ? "Battle player state." : "Realtime Redis lobby state."}
                    </p>
                </div>

                <button className="ghost-button" type="button" onClick={onRefresh}>
                    Refresh
                </button>
            </div>

            <div className="player-list">
                {players.map((player) => {
                    const battlePlayer = battle?.players[player.telegramUserId];

                    return (
                        <div className="player-row" key={player.telegramUserId}>
                            <div className="player-main">
                                <span className="avatar">{player.isHost ? "👑" : "⚔️"}</span>

                                <div>
                                    <strong>{player.displayName}</strong>

                                    <span>
                                        {player.isHost ? "Host" : "Player"}
                                        {player.telegramUserId === currentUserId ? " · You" : ""}
                                        {battlePlayer
                                            ? ` · HP ${battlePlayer.hp}/${battlePlayer.maxHp} · Combo ${battlePlayer.combo}`
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
    );
}
