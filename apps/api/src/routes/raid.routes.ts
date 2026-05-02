import { Router } from "express";
import type { RaidService } from "../raids/raid.service.js";

type CreateRaidRouterOptions = {
    raidService: RaidService;
};

export function createRaidRouter({ raidService }: CreateRaidRouterOptions): Router {
    const router = Router();

    router.get("/raids/:raidId", async (req, res) => {
        const raid = await raidService.getRaid(req.params.raidId);

        if (!raid) {
            res.status(404).json({
                ok: false,
                error: "raid_not_found"
            });
            return;
        }

        res.json({
            ok: true,
            raid,
            serverTime: Date.now()
        });
    });

    router.post("/raids/:raidId/join", async (req, res) => {
        const telegramUserId = String(req.body?.telegramUserId ?? "").trim();
        const displayName = String(req.body?.displayName ?? "").trim();

        if (!telegramUserId || !displayName) {
            res.status(400).json({
                ok: false,
                error: "telegramUserId and displayName are required"
            });
            return;
        }

        if (displayName.length > 64) {
            res.status(400).json({
                ok: false,
                error: "displayName is too long"
            });
            return;
        }

        const result = await raidService.joinRaid({
            raidId: req.params.raidId,
            telegramUserId,
            displayName
        });

        if (!result.ok) {
            const statusCodeByReason = {
                raid_not_found: 404,
                raid_expired: 410,
                raid_not_joinable: 409,
                raid_full: 409
            } satisfies Record<typeof result.reason, number>;

            res.status(statusCodeByReason[result.reason]).json({
                ok: false,
                error: result.reason
            });
            return;
        }

        res.json({
            ok: true,
            raid: result.raid,
            player: result.player
        });
    });

    return router;
}