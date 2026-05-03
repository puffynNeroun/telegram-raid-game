import { formatTimeLeft } from "../time";
import type { BattleInputKey, BattleInputRating, BattleNote } from "../types";

const NOTE_LOOK_BEHIND_MS = 650;
const NOTE_LOOK_AHEAD_MS = 3200;
const MAX_VISIBLE_NOTES = 8;

const UI_PERFECT_WINDOW_MS = 140;
const UI_GOOD_WINDOW_MS = 320;
const UI_MISS_WINDOW_MS = 560;

export function getVisibleNotes(notes: BattleNote[], now: number): BattleNote[] {
    if (now <= 0) {
        return [];
    }

    return notes
        .filter((note) => {
            if (note.status !== "pending") {
                return false;
            }

            return (
                note.hitAt >= now - NOTE_LOOK_BEHIND_MS &&
                note.hitAt <= now + NOTE_LOOK_AHEAD_MS
            );
        })
        .sort((a, b) => a.hitAt - b.hitAt)
        .slice(0, MAX_VISIBLE_NOTES);
}

export function getCurrentTargetNote(notes: BattleNote[], now: number): BattleNote | null {
    if (now <= 0) {
        return null;
    }

    const pendingNotes = notes
        .filter((note) => note.status === "pending")
        .sort((a, b) => a.hitAt - b.hitAt);

    const activeCandidate = pendingNotes.find((note) => {
        return note.hitAt >= now - NOTE_LOOK_BEHIND_MS;
    });

    return activeCandidate ?? pendingNotes[0] ?? null;
}

export function getBattleInputKeyFromKeyboard(key: string): BattleInputKey | null {
    if (key === "ArrowLeft" || key.toLowerCase() === "a") {
        return "left";
    }

    if (key === "ArrowUp" || key.toLowerCase() === "w") {
        return "up";
    }

    if (key === "ArrowDown" || key.toLowerCase() === "s") {
        return "down";
    }

    if (key === "ArrowRight" || key.toLowerCase() === "d") {
        return "right";
    }

    return null;
}

export function getBossHpPercent(currentHp: number, maxHp: number): number {
    if (maxHp <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
}

export function getBattleTimeLabel(status: "active" | "finished"): string {
    return status === "finished" ? "Battle ended" : "Battle ends";
}

export function getBattlePanelClassName(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    return `panel battle-panel ${getBattleStateClassName(status, outcome)}`;
}

export function getBattleTimerClassName(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    return `battle-timer ${getBattleStateClassName(status, outcome)}`;
}

export function getBattleTitle(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    if (status === "active") {
        return "Battle active";
    }

    if (outcome === "win") {
        return "Boss defeated";
    }

    if (outcome === "lose") {
        return "Raid failed";
    }

    return "Battle finished";
}

export function getBattleDescription(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    if (status === "active") {
        return "Hit matching notes inside the timing window.";
    }

    if (outcome === "win") {
        return "The team defeated the boss before the timer expired.";
    }

    if (outcome === "lose") {
        return "The timer expired before the boss was defeated.";
    }

    return "The battle has ended.";
}

export function getNoteTimingClassName(note: BattleNote, now: number): string {
    if (now <= 0) {
        return "is-upcoming";
    }

    const deltaMs = note.hitAt - now;

    if (deltaMs < -UI_MISS_WINDOW_MS) {
        return "is-late";
    }

    if (Math.abs(deltaMs) <= UI_PERFECT_WINDOW_MS) {
        return "is-hit-window";
    }

    if (Math.abs(deltaMs) <= UI_GOOD_WINDOW_MS) {
        return "is-good-window";
    }

    if (Math.abs(deltaMs) <= UI_MISS_WINDOW_MS) {
        return "is-miss-window";
    }

    if (deltaMs <= 900) {
        return "is-soon";
    }

    return "is-upcoming";
}

export function formatNoteDelta(hitAt: number, now: number): string {
    if (now <= 0) {
        return "sync";
    }

    const deltaMs = hitAt - now;
    const absSeconds = Math.abs(deltaMs) / 1000;

    if (Math.abs(deltaMs) <= 80) {
        return "now";
    }

    if (deltaMs > 0) {
        return `in ${absSeconds.toFixed(1)}s`;
    }

    return `${absSeconds.toFixed(1)}s late`;
}

export function formatClock(timestamp: number, now: number): string {
    if (now <= 0) {
        return "--";
    }

    return formatTimeLeft(timestamp, now);
}

export function formatInputKey(key: BattleInputKey): string {
    switch (key) {
        case "left":
            return "←";
        case "up":
            return "↑";
        case "down":
            return "↓";
        case "right":
            return "→";
    }
}

export function formatRating(rating: BattleInputRating): string {
    switch (rating) {
        case "perfect":
            return "Perfect";
        case "good":
            return "Good";
        case "miss":
            return "Miss";
        case "wrong":
            return "Wrong";
    }
}

export function getRatingClassName(rating: BattleInputRating): string {
    switch (rating) {
        case "perfect":
            return "is-perfect";
        case "good":
            return "is-good";
        case "miss":
            return "is-miss";
        case "wrong":
            return "is-wrong";
    }
}

export function formatStunTimeLeft(stunnedUntil: number | null, now: number): string {
    if (!stunnedUntil || stunnedUntil <= now || now <= 0) {
        return "0.0s";
    }

    return `${((stunnedUntil - now) / 1000).toFixed(1)}s`;
}

function getBattleStateClassName(
    status: "active" | "finished",
    outcome: "win" | "lose" | null
): string {
    if (status !== "finished") {
        return "";
    }

    if (outcome === "win") {
        return "is-win";
    }

    if (outcome === "lose") {
        return "is-lose";
    }

    return "is-finished";
}
