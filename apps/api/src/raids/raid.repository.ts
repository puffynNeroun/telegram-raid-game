import type { Redis } from "ioredis";
import type { Raid } from "./raid.types.js";
import { RAID_TTL_SECONDS } from "./raid.types.js";

export class RaidRepository {
    constructor(private readonly redis: Redis) {}

    async createRaid(raid: Raid): Promise<boolean> {
        const activeKey = this.activeRaidByChatKey(raid.telegramChatId);

        const created = await this.redis.set(
            activeKey,
            raid.id,
            "EX",
            RAID_TTL_SECONDS,
            "NX"
        );

        if (created !== "OK") {
            return false;
        }

        await this.redis.set(
            this.raidKey(raid.id),
            JSON.stringify(raid),
            "EX",
            RAID_TTL_SECONDS
        );

        return true;
    }

    async saveRaid(raid: Raid): Promise<void> {
        const ttlSeconds = Math.max(1, Math.ceil((raid.expiresAt - Date.now()) / 1000));

        await this.redis.set(
            this.raidKey(raid.id),
            JSON.stringify(raid),
            "EX",
            ttlSeconds
        );
    }

    async getRaid(raidId: string): Promise<Raid | null> {
        const rawRaid = await this.redis.get(this.raidKey(raidId));
        return this.parseRaid(rawRaid);
    }

    async getActiveRaidByChat(telegramChatId: string): Promise<Raid | null> {
        const raidId = await this.redis.get(this.activeRaidByChatKey(telegramChatId));

        if (!raidId) {
            return null;
        }

        return this.getRaid(raidId);
    }

    async cancelRaid(raid: Raid): Promise<void> {
        const cancelledRaid: Raid = {
            ...raid,
            status: "cancelled"
        };

        const ttlSeconds = Math.max(1, Math.ceil((raid.expiresAt - Date.now()) / 1000));

        await this.redis
            .multi()
            .set(this.raidKey(raid.id), JSON.stringify(cancelledRaid), "EX", ttlSeconds)
            .del(this.activeRaidByChatKey(raid.telegramChatId))
            .exec();
    }

    private raidKey(raidId: string): string {
        return `raid:${raidId}`;
    }

    private activeRaidByChatKey(telegramChatId: string): string {
        return `active_raid_by_chat:${telegramChatId}`;
    }

    private parseRaid(rawRaid: string | null): Raid | null {
        if (!rawRaid) {
            return null;
        }

        try {
            return JSON.parse(rawRaid) as Raid;
        } catch {
            return null;
        }
    }
}