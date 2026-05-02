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
            res.status(getStatusCodeByReason(result.reason)).json({
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

    router.post("/raids/:raidId/ready", async (req, res) => {
        const telegramUserId = String(req.body?.telegramUserId ?? "").trim();
        const isReady = Boolean(req.body?.isReady);

        if (!telegramUserId) {
            res.status(400).json({
                ok: false,
                error: "telegramUserId is required"
            });
            return;
        }

        const result = await raidService.setReady({
            raidId: req.params.raidId,
            telegramUserId,
            isReady
        });

        if (!result.ok) {
            res.status(getStatusCodeByReason(result.reason)).json({
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

    router.post("/raids/:raidId/start", async (req, res) => {
        const telegramUserId = String(req.body?.telegramUserId ?? "").trim();

        if (!telegramUserId) {
            res.status(400).json({
                ok: false,
                error: "telegramUserId is required"
            });
            return;
        }

        const result = await raidService.startRaid({
            raidId: req.params.raidId,
            telegramUserId
        });

        if (!result.ok) {
            res.status(getStatusCodeByReason(result.reason)).json({
                ok: false,
                error: result.reason
            });
            return;
        }

        res.json({
            ok: true,
            raid: result.raid
        });
    });

    return router;
}

function getStatusCodeByReason(reason: string): number {
    const statusCodeByReason: Record<string, number> = {
        raid_not_found: 404,
        raid_expired: 410,
        raid_not_joinable: 409,
        raid_full: 409,
        player_not_in_raid: 403,
        only_host_can_start: 403,
        no_ready_players: 409
    };

    return statusCodeByReason[reason] ?? 400;
}