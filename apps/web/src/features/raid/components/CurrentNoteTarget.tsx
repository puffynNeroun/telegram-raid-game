import { formatInputKey, formatNoteDelta, getNoteTimingClassName } from "./battleUi";
import type { BattleNote } from "../types";

type CurrentNoteTargetProps = {
    note: BattleNote | null;
    localNow: number;
};

export function CurrentNoteTarget({ note, localNow }: CurrentNoteTargetProps) {
    return (
        <section className="current-note-panel">
            <span className="current-note-label">Current target</span>

            {note ? (
                <div
                    className={`current-note-target current-note-${note.key} ${getNoteTimingClassName(
                        note,
                        localNow
                    )}`}
                >
                    <span className="current-note-symbol">{formatInputKey(note.key)}</span>

                    <span className="current-note-time">
                        {formatNoteDelta(note.hitAt, localNow)}
                    </span>
                </div>
            ) : (
                <div className="current-note-empty">Waiting for next note</div>
            )}
        </section>
    );
}
