import { useEffect } from "react";
import { getBattleInputKeyFromKeyboard } from "./battleUi";
import type { BattleInputKey } from "../types";

const BATTLE_INPUT_CONTROLS: Array<{
    key: BattleInputKey;
    keyboardLabel: string;
}> = [
    {
        key: "left",
        keyboardLabel: "Left"
    },
    {
        key: "up",
        keyboardLabel: "Up"
    },
    {
        key: "down",
        keyboardLabel: "Down"
    },
    {
        key: "right",
        keyboardLabel: "Right"
    }
];

type BattleControlsProps = {
    canSendBattleInput: boolean;
    isInputSending: boolean;
    onBattleInput: (key: BattleInputKey) => void;
};

export function BattleControls({
                                   canSendBattleInput,
                                   isInputSending,
                                   onBattleInput
                               }: BattleControlsProps) {
    useEffect(() => {
        if (!canSendBattleInput) {
            return;
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.repeat) {
                return;
            }

            const inputKey = getBattleInputKeyFromKeyboard(event.key);

            if (!inputKey) {
                return;
            }

            event.preventDefault();
            onBattleInput(inputKey);
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [canSendBattleInput, onBattleInput]);

    return (
        <section
            className="battle-controls-panel"
            aria-label="Battle input controls"
        >
            <div className="input-pad">
                {BATTLE_INPUT_CONTROLS.map((control) => (
                    <button
                        className={`input-button input-button-${control.key}`}
                        key={control.key}
                        type="button"
                        disabled={!canSendBattleInput}
                        onClick={() => onBattleInput(control.key)}
                        aria-label={`Send ${control.keyboardLabel} input`}
                    >
                        <span className="input-button-symbol" aria-hidden="true">
                            <DirectionGlyph direction={control.key} />
                        </span>

                        <span className="input-button-label">
                            {control.keyboardLabel}
                        </span>
                    </button>
                ))}
            </div>

            <p className="hint-text input-hint">
                {isInputSending
                    ? "Syncing input with server..."
                    : "Hit the current target. Keyboard: arrows or WASD."}
            </p>
        </section>
    );
}

function DirectionGlyph({ direction }: { direction: BattleInputKey }) {
    const paths: Record<BattleInputKey, string> = {
        left: "M19 12H5M11 6l-6 6 6 6",
        up: "M12 19V5M6 11l6-6 6 6",
        down: "M12 5v14M6 13l6 6 6-6",
        right: "M5 12h14M13 6l6 6-6 6"
    };

    return (
        <svg
            className="direction-glyph"
            viewBox="0 0 24 24"
            fill="none"
            focusable="false"
            aria-hidden="true"
        >
            <path
                d={paths[direction]}
                stroke="currentColor"
                strokeWidth="2.35"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}