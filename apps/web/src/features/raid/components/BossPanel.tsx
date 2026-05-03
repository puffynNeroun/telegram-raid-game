import { getBossHpPercent } from "./battleUi";
import type { BattleState, RaidStatus } from "../types";

type BossPanelProps = {
    battle: BattleState | null;
    raidStatus: RaidStatus | null;
};

export function BossPanel({ battle, raidStatus }: BossPanelProps) {
    const bossHpPercent = battle
        ? getBossHpPercent(battle.boss.hp, battle.boss.maxHp)
        : 100;

    return (
        <section className="boss-panel">
            <div className="boss-art">👹</div>

            <div className="boss-info">
                <div className="boss-row">
                    <h2>{battle?.boss.name ?? "Meme Boss"}</h2>

                    <span>
                        {battle
                            ? `${battle.boss.hp}/${battle.boss.maxHp} HP`
                            : raidStatus === "battle"
                                ? "Battle started"
                                : "Lobby phase"}
                    </span>
                </div>

                <div className="hp-bar" aria-label="Boss health">
                    <div className="hp-bar-fill" style={{ width: `${bossHpPercent}%` }} />
                </div>
            </div>
        </section>
    );
}
