import type { Redis } from "ioredis";
import type { Raid } from "./raid.types.js";

export class RaidRepository {
    constructor(private readonly redis: Redis) {}

    async createRaid(raid: Raid): Promise<boolean> {
        const reserved = await this.reserveActiveRaid(raid);

        if (!reserved) {
            const activeRaid = await this.getActiveRaidByChat(raid.telegramChatId);

            if (activeRaid) {
                return false;
            }

            const retriedReservation = await this.reserveActiveRaid(raid);

            if (!retriedReservation) {
                return false;
            }
        }

        try {
            await this.redis.set(
                this.raidKey(raid.id),
                JSON.stringify(raid),
                "EX",
                getRaidTtlSeconds(raid)
            );

            return true;
        } catch (error) {
            await this.releaseActiveRaidIfCurrent(raid);
            throw error;
        }
    }

    async saveRaid(raid: Raid): Promise<void> {
        await this.redis.set(
            this.raidKey(raid.id),
            JSON.stringify(raid),
            "EX",
            getRaidTtlSeconds(raid)
        );

        if (isBlockingActiveRaid(raid)) {
            await this.setActiveRaidIfAllowed(raid);
            return;
        }

        await this.releaseActiveRaidIfCurrent(raid);
    }

    async getRaid(raidId: string): Promise<Raid | null> {
        const rawRaid = await this.redis.get(this.raidKey(raidId));

        return this.parseRaid(rawRaid);
    }

    async getActiveRaidByChat(telegramChatId: string): Promise<Raid | null> {
        const activeKey = this.activeRaidByChatKey(telegramChatId);
        const raidId = await this.redis.get(activeKey);

        if (!raidId) {
            return null;
        }

        const raid = await this.getRaid(raidId);

        if (!raid) {
            await this.redis.del(activeKey);
            return null;
        }

        if (!isBlockingActiveRaid(raid)) {
            await this.releaseActiveRaidIfCurrent(raid);
            return null;
        }

        return raid;
    }

    async cancelRaid(raid: Raid): Promise<void> {
        await this.saveRaid({
            ...raid,
            status: "cancelled"
        });
    }

    private async reserveActiveRaid(raid: Raid): Promise<boolean> {
        const created = await this.redis.set(
            this.activeRaidByChatKey(raid.telegramChatId),
            raid.id,
            "EX",
            getActiveRaidTtlSeconds(raid),
            "NX"
        );

        return created === "OK";
    }

    private async setActiveRaidIfAllowed(raid: Raid): Promise<void> {
        await this.redis.eval(
            `
            local current = redis.call("GET", KEYS[1])

            if not current or current == ARGV[1] then
                redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
                return 1
            end

            return 0
            `,
            1,
            this.activeRaidByChatKey(raid.telegramChatId),
            raid.id,
            String(getActiveRaidTtlSeconds(raid))
        );
    }

    private async releaseActiveRaidIfCurrent(raid: Raid): Promise<void> {
        await this.redis.eval(
            `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            end

            return 0
            `,
            1,
            this.activeRaidByChatKey(raid.telegramChatId),
            raid.id
        );
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

function getRaidTtlSeconds(raid: Raid): number {
    return Math.max(1, Math.ceil((raid.expiresAt - Date.now()) / 1000));
}

function getActiveRaidTtlSeconds(raid: Raid): number {
    if (raid.status === "battle" && raid.battle?.status === "active") {
        return Math.max(1, Math.ceil((raid.battle.endsAt - Date.now()) / 1000));
    }

    return getRaidTtlSeconds(raid);
}

function isBlockingActiveRaid(raid: Raid): boolean {
    const now = Date.now();

    if (raid.status === "lobby") {
        return now < raid.expiresAt;
    }

    if (raid.status === "battle" && raid.battle?.status === "active") {
        return now < raid.battle.endsAt;
    }

    return false;
}