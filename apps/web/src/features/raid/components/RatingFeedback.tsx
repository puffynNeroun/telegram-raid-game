import { formatRating, getRatingClassName } from "./battleUi";
import type { BattleInputRating } from "../types";

type RatingFeedbackProps = {
    rating: BattleInputRating;
    damageDealt: number;
    damageTaken: number;
};

export function RatingFeedback({ rating, damageDealt, damageTaken }: RatingFeedbackProps) {
    return (
        <div className={`rating-feedback ${getRatingClassName(rating)}`}>
            <strong>{formatRating(rating)}</strong>

            <span>{getRatingImpactText(damageDealt, damageTaken)}</span>
        </div>
    );
}

function getRatingImpactText(damageDealt: number, damageTaken: number): string {
    if (damageDealt > 0) {
        return `+${damageDealt} dmg`;
    }

    if (damageTaken > 0) {
        return `-${damageTaken} HP`;
    }

    return "No damage";
}
