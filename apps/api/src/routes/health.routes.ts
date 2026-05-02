import { Router } from "express";
import type { Redis } from "ioredis";
import type { HealthResponse } from "@raid-game/shared";

type Dependencies = {
    redis: Redis;
};

export function createHealthRouter({ redis }: Dependencies): Router {
    const router = Router();

    router.get("/health", async (_req, res) => {
        let redisStatus: HealthResponse["redis"] = "down";

        try {
            const pong = await redis.ping();
            redisStatus = pong === "PONG" ? "up" : "down";
        } catch {
            redisStatus = "down";
        }

        const body: HealthResponse = {
            ok: redisStatus === "up",
            service: "api",
            redis: redisStatus
        };

        res.status(body.ok ? 200 : 503).json(body);
    });

    return router;
}