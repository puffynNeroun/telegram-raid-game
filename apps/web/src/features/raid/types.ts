export type RaidPhase = "lobby" | "battle" | "results";

export type Player = {
    id: string;
    name: string;
    avatar: string;
    damage: number;
    ready: boolean;
};

export type Boss = {
    name: string;
    maxHp: number;
    hp: number;
};

export type RaidState = {
    phase: RaidPhase;
    boss: Boss;
    players: Player[];
    timeLeft: number;
    currentPlayerId: string;
};
