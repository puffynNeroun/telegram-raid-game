import type { RaidState } from "./types";

export const BATTLE_DURATION_SECONDS = 30;

export const initialRaidState: RaidState = {
    phase: "lobby",
    timeLeft: BATTLE_DURATION_SECONDS,
    currentPlayerId: "player-1",
    boss: {
        name: "Toxic Boss",
        maxHp: 5000,
        hp: 5000,
    },
    players: [
        {
            id: "player-1",
            name: "You",
            avatar: "🧙",
            damage: 0,
            ready: false,
        },
        {
            id: "player-2",
            name: "InvokerEnjoyer",
            avatar: "🔥",
            damage: 0,
            ready: false,
        },
        {
            id: "player-3",
            name: "NoBKB",
            avatar: "🪓",
            damage: 0,
            ready: false,
        },
    ],
};
