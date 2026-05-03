import { formatStunTimeLeft } from "./battleUi";
import { RatingFeedback } from "./RatingFeedback";
import type { BattlePlayerState } from "../types";

type CombatStatsProps = {
    player: BattlePlayerState;
    isStunned: boolean;
    localNow: number;
};

export function CombatStats({ player, isStunned, localNow }: CombatStatsProps) {
    return (
        <section className="player-combat-panel">
            <div className="player-combat-grid">
                <div className="combat-stat">
                    <span>Your HP</span>
                    <strong>
                        {player.hp}/{player.maxHp}
                    </strong>
                </div>

                <div className="combat-stat">
                    <span>Combo</span>
                    <strong>{player.combo}</strong>
                </div>

                <div className="combat-stat">
                    <span>Max combo</span>
                    <strong>{player.maxCombo}</strong>
                </div>

                <div className="combat-stat">
                    <span>Deaths</span>
                    <strong>{player.deaths}</strong>
                </div>
            </div>

            {player.lastRating && (
                <RatingFeedback
                    rating={player.lastRating}
                    damageDealt={player.lastDamageDealt}
                    damageTaken={player.lastDamageTaken}
                />
            )}

            {isStunned && (
                <div className="stun-warning">
                    Stunned for {formatStunTimeLeft(player.stunnedUntil, localNow)}
                </div>
            )}
        </section>
    );
}
