import { useEffect } from "react";
import { getBattleInputKeyFromKeyboard } from "./battleUi";
import type { BattleInputKey } from "../types";

const BATTLE_INPUT_CONTROLS: Array<{
    key: BattleInputKey;
    label: string;
    keyboardLabel: string;
}> = [
    {
        key: "left",
        label: "←",
        keyboardLabel: "Left"
    },
    {
        key: "up",
        label: "↑",
        keyboardLabel: "Up"
    },
    {
        key: "down",
        label: "↓",
        keyboardLabel: "Down"
    },
    {
        key: "right",
        label: "→",
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
        <>
            <div className="input-pad" aria-label="Battle input controls">
                {BATTLE_INPUT_CONTROLS.map((control) => (
                    <button
                        className={`input-button input-button-${control.key}`}
                        key={control.key}
                        type="button"
                        disabled={!canSendBattleInput}
                        onClick={() => onBattleInput(control.key)}
                        aria-label={`Send ${control.keyboardLabel} input`}
                    >
                        <span className="input-button-symbol">{control.label}</span>

                        <span className="input-button-label">{control.keyboardLabel}</span>
                    </button>
                ))}
            </div>

            <p className="hint-text input-hint">
                {isInputSending
                    ? "Syncing input with server..."
                    : "Hit the current target. Keyboard: arrows or WASD."}
            </p>
        </>
    );
}
