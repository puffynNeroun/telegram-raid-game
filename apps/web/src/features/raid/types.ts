export type RaidStatus = "lobby" | "cancelled" | "battle" | "finished";

export type RaidPlayer = {
    telegramUserId: string;
    displayName: string;
    isHost: boolean;
    isReady: boolean;
    joinedAt: number;
};

export type Raid = {
    id: string;
    telegramChatId: string;
    hostTelegramUserId: string;
    hostDisplayName: string;
    status: RaidStatus;
    createdAt: number;
    expiresAt: number;
    players: Record<string, RaidPlayer>;
};

export type RaidState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "loaded"; raid: Raid; serverTime: number }
    | { status: "error"; message: string };

export type TelegramUser = {
    id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
};

export type CurrentUser = {
    id: string;
    displayName: string;
    source: "telegram" | "dev" | "local";
};