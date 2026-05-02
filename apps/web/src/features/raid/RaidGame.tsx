import { useEffect, useMemo, useState } from "react";
import { BATTLE_DURATION_SECONDS, initialRaidState } from "./raidState";
import type { RaidState } from "./types";

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function RaidGame() {
    const [raid, setRaid] = useState<RaidState>(initialRaidState);

    const currentPlayer = raid.players.find(
        (player) => player.id === raid.currentPlayerId
    );

    const bossHpPercent = useMemo(() => {
        return clamp((raid.boss.hp / raid.boss.maxHp) * 100, 0, 100);
    }, [raid.boss.hp, raid.boss.maxHp]);

    const totalDamage = useMemo(() => {
        return raid.players.reduce((sum, player) => sum + player.damage, 0);
    }, [raid.players]);

    const sortedPlayers = useMemo(() => {
        return [...raid.players].sort((a, b) => b.damage - a.damage);
    }, [raid.players]);

    const allPlayersReady = raid.players.every((player) => player.ready);

    useEffect(() => {
        if (raid.phase !== "battle") return;

        const timer = window.setInterval(() => {
            setRaid((current) => {
                if (current.phase !== "battle") return current;

                const nextTimeLeft = current.timeLeft - 1;

                if (nextTimeLeft <= 0 || current.boss.hp <= 0) {
                    return {
                        ...current,
                        phase: "results",
                        timeLeft: 0,
                    };
                }

                return {
                    ...current,
                    timeLeft: nextTimeLeft,
                };
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [raid.phase]);

    function toggleReady(playerId: string) {
        setRaid((current) => ({
            ...current,
            players: current.players.map((player) =>
                player.id === playerId ? { ...player, ready: !player.ready } : player
            ),
        }));
    }

    function startBattle() {
        if (!allPlayersReady) return;

        setRaid((current) => ({
            ...current,
            phase: "battle",
            timeLeft: BATTLE_DURATION_SECONDS,
        }));
    }

    function hitBoss() {
        if (raid.phase !== "battle") return;

        const damage = Math.floor(Math.random() * 85) + 65;

        setRaid((current) => {
            const nextBossHp = Math.max(current.boss.hp - damage, 0);

            return {
                ...current,
                boss: {
                    ...current.boss,
                    hp: nextBossHp,
                },
                players: current.players.map((player) =>
                    player.id === current.currentPlayerId
                        ? { ...player, damage: player.damage + damage }
                        : player
                ),
                phase: nextBossHp <= 0 ? "results" : current.phase,
            };
        });
    }

    function resetRaid() {
        setRaid(initialRaidState);
    }

    return (
        <main className="app-shell">
            <section className="game-card">
                <header className="game-header">
                    <div>
                        <p className="eyebrow">Telegram Mini App MVP</p>
                        <h1>Co-op Raid</h1>
                    </div>

                    <div className="status-pill">
                        {raid.phase === "lobby" && "Lobby"}
                        {raid.phase === "battle" && `${raid.timeLeft}s`}
                        {raid.phase === "results" && "Results"}
                    </div>
                </header>

                <section className="boss-panel">
                    <div className="boss-art">👹</div>

                    <div className="boss-info">
                        <div className="boss-row">
                            <h2>{raid.boss.name}</h2>
                            <span>
                {raid.boss.hp} / {raid.boss.maxHp} HP
              </span>
                        </div>

                        <div className="hp-bar" aria-label="Boss health">
                            <div
                                className="hp-bar-fill"
                                style={{ width: `${bossHpPercent}%` }}
                            />
                        </div>
                    </div>
                </section>

                {raid.phase === "lobby" && (
                    <section className="panel">
                        <h3>Raid Lobby</h3>
                        <p className="muted">
                            Players must be ready before the host starts the fight.
                        </p>

                        <div className="player-list">
                            {raid.players.map((player) => (
                                <button
                                    key={player.id}
                                    className="player-row"
                                    type="button"
                                    onClick={() => toggleReady(player.id)}
                                >
                                    <span className="avatar">{player.avatar}</span>
                                    <span>{player.name}</span>
                                    <strong>{player.ready ? "Ready" : "Not ready"}</strong>
                                </button>
                            ))}
                        </div>

                        <button
                            className="primary-button"
                            type="button"
                            disabled={!allPlayersReady}
                            onClick={startBattle}
                        >
                            Start Raid
                        </button>
                    </section>
                )}

                {raid.phase === "battle" && (
                    <section className="panel battle-panel">
                        <h3>Battle Phase</h3>
                        <p className="muted">
                            Tap to deal damage. Later this will become real multiplayer sync.
                        </p>

                        <button className="hit-button" type="button" onClick={hitBoss}>
                            Strike
                        </button>

                        <p className="damage-line">
                            Your damage: <strong>{currentPlayer?.damage ?? 0}</strong>
                        </p>
                    </section>
                )}

                {raid.phase === "results" && (
                    <section className="panel">
                        <h3>{raid.boss.hp <= 0 ? "Boss defeated" : "Raid finished"}</h3>
                        <p className="muted">Total raid damage: {totalDamage}</p>

                        <div className="leaderboard">
                            {sortedPlayers.map((player, index) => (
                                <div className="leaderboard-row" key={player.id}>
                  <span>
                    #{index + 1} {player.avatar} {player.name}
                  </span>
                                    <strong>{player.damage}</strong>
                                </div>
                            ))}
                        </div>

                        <button className="primary-button" type="button" onClick={resetRaid}>
                            New Raid
                        </button>
                    </section>
                )}
            </section>
        </main>
    );
}
