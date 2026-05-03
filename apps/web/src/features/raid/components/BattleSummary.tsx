import type { ReactNode } from "react";
import {
    getBattleDescription,
    getBattlePanelClassName,
    getBattleTimerClassName,
    getBattleTitle
} from "./battleUi";
import type { BattleState } from "../types";

type BattleSummaryProps = {
    battle: BattleState;
    battleTimeLeft: string | null;
    children?: ReactNode;
};

export function BattleSummary({ battle, battleTimeLeft, children }: BattleSummaryProps) {
    return (
        <section className={getBattlePanelClassName(battle.status, battle.outcome)}>
            <div className="battle-header">
                <div>
                    <h3>{getBattleTitle(battle.status, battle.outcome)}</h3>

                    <p className="muted small">
                        {getBattleDescription(battle.status, battle.outcome)}
                    </p>
                </div>

                <strong className={getBattleTimerClassName(battle.status, battle.outcome)}>
                    {battleTimeLeft}
                </strong>
            </div>

            <div className="battle-stats-grid">
                <div className="battle-stat">
                    <span>Boss HP</span>
                    <strong>
                        {battle.boss.hp}/{battle.boss.maxHp}
                    </strong>
                </div>

                <div className="battle-stat">
                    <span>Phase</span>
                    <strong>{battle.boss.phase}</strong>
                </div>

                <div className="battle-stat">
                    <span>Outcome</span>
                    <strong>{battle.outcome ?? "pending"}</strong>
                </div>
            </div>

            {children}
        </section>
    );
}
