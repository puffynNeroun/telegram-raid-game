import express from "express";
import cors from "cors";
import type { Redis } from "ioredis";
import type { RaidService } from "./raids/raid.service.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createRaidRouter } from "./routes/raid.routes.js";

type CreateAppOptions = {
    redis: Redis;
    raidService: RaidService;
};

export function createApp({ redis, raidService }: CreateAppOptions) {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use(createHealthRouter({ redis }));
    app.use(createRaidRouter({ raidService }));

    app.use((_req, res) => {
        res.status(404).json({
            ok: false,
            error: "Route not found"
        });
    });

    return app;
}