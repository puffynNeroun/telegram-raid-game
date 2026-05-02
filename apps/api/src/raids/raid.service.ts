import { nanoid } from "nanoid";
import type {
    CreateRaidInput,
    CreateRaidResult,
    JoinRaidInput,
    JoinRaidResult,
    Raid
} from "./raid.types.js";
import { MAX_PLAYERS_PER_RAID, RAID_TTL_SECONDS } from "./raid.types.js";
import type { RaidRepository } from "./raid.repository.js";

export class RaidService {
    constructor(private readonly raidRepository: RaidRepository) {}

    async createRaid(input: CreateRaidInput): Promise<CreateRaidResult> {
        const now = Date.now();

        const raid: Raid = {
            id: nanoid(10),
            telegramChatId: input.telegramChatId,
            hostTelegramUserId: input.hostTelegramUserId,
            hostDisplayName: input.hostDisplayName,
            status: "lobby",
            createdAt: now,
            expiresAt: now + RAID_TTL_SECONDS * 1000,
            players: {
                [input.hostTelegramUserId]: {
                    telegramUserId: input.hostTelegramUserId,
                    displayName: input.hostDisplayName,
                    isHost: true,
                    isReady: false,
                    joinedAt: now
                }
            }
        };

        const created = await this.raidRepository.createRaid(raid);

        if (!created) {
            const activeRaid = await this.raidRepository.getActiveRaidByChat(
                input.telegramChatId
            );

            return {
                ok: false,
                reason: "active_raid_exists",
                activeRaid
            };
        }

        return {
            ok: true,
            raid
        };
    }

    async getRaid(raidId: string): Promise<Raid | null> {
        return this.raidRepository.getRaid(raidId);
    }

    async joinRaid(input: JoinRaidInput): Promise<JoinRaidResult> {
        const raid = await this.raidRepository.getRaid(input.raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        if (Date.now() >= raid.expiresAt) {
            return {
                ok: false,
                reason: "raid_expired"
            };
        }

        if (raid.status !== "lobby") {
            return {
                ok: false,
                reason: "raid_not_joinable"
            };
        }

        const existingPlayer = raid.players[input.telegramUserId];

        if (existingPlayer) {
            return {
                ok: true,
                raid,
                player: existingPlayer
            };
        }

        const playerCount = Object.keys(raid.players).length;

        if (playerCount >= MAX_PLAYERS_PER_RAID) {
            return {
                ok: false,
                reason: "raid_full"
            };
        }

        const player = {
            telegramUserId: input.telegramUserId,
            displayName: input.displayName,
            isHost: false,
            isReady: false,
            joinedAt: Date.now()
        };

        const updatedRaid: Raid = {
            ...raid,
            players: {
                ...raid.players,
                [input.telegramUserId]: player
            }
        };

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid,
            player
        };
    }
}