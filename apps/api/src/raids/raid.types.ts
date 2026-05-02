export const RAID_TTL_SECONDS = 120;
export const MAX_PLAYERS_PER_RAID = 6;

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

export type CreateRaidInput = {
    telegramChatId: string;
    hostTelegramUserId: string;
    hostDisplayName: string;
};

export type CreateRaidResult =
    | {
    ok: true;
    raid: Raid;
}
    | {
    ok: false;
    reason: "active_raid_exists";
    activeRaid: Raid | null;
};

export type JoinRaidInput = {
    raidId: string;
    telegramUserId: string;
    displayName: string;
};

export type JoinRaidResult =
    | {
    ok: true;
    raid: Raid;
    player: RaidPlayer;
}
    | {
    ok: false;
    reason: "raid_not_found" | "raid_expired" | "raid_not_joinable" | "raid_full";
};

export type SetReadyInput = {
    raidId: string;
    telegramUserId: string;
    isReady: boolean;
};

export type SetReadyResult =
    | {
    ok: true;
    raid: Raid;
    player: RaidPlayer;
}
    | {
    ok: false;
    reason:
        | "raid_not_found"
        | "raid_expired"
        | "raid_not_joinable"
        | "player_not_in_raid";
};

export type StartRaidInput = {
    raidId: string;
    telegramUserId: string;
};

export type StartRaidResult =
    | {
    ok: true;
    raid: Raid;
}
    | {
    ok: false;
    reason:
        | "raid_not_found"
        | "raid_expired"
        | "raid_not_joinable"
        | "player_not_in_raid"
        | "only_host_can_start"
        | "no_ready_players";
};