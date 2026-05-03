import { formatInputKey, formatNoteDelta, getNoteTimingClassName } from "./battleUi";
import type { BattleNote } from "../types";

type UpcomingNotesProps = {
    notes: BattleNote[];
    currentTargetNote: BattleNote | null;
    localNow: number;
};

export function UpcomingNotes({ notes, currentTargetNote, localNow }: UpcomingNotesProps) {
    return (
        <section className="note-lanes" aria-label="Upcoming battle notes">
            <div className="note-lanes-header">
                <span>Upcoming notes</span>

                {currentTargetNote ? (
                    <strong>
                        Next: {formatInputKey(currentTargetNote.key)} ·{" "}
                        {formatNoteDelta(currentTargetNote.hitAt, localNow)}
                    </strong>
                ) : (
                    <strong>No pending notes</strong>
                )}
            </div>

            <div className="note-list">
                {notes.length > 0 ? (
                    notes.map((note) => (
                        <div
                            className={`note-chip note-chip-${note.key} ${getNoteTimingClassName(
                                note,
                                localNow
                            )}`}
                            key={note.id}
                        >
                            <span className="note-symbol">{formatInputKey(note.key)}</span>

                            <span className="note-time">
                                {formatNoteDelta(note.hitAt, localNow)}
                            </span>
                        </div>
                    ))
                ) : (
                    <p className="hint-text note-empty">Waiting for the next server note.</p>
                )}
            </div>
        </section>
    );
}
