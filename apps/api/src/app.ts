import express from "express";
import cors from "cors";
import type { Redis } from "ioredis";
import { createHealthRouter } from "./routes/health.routes.js";

type CreateAppOptions = {
    redis: Redis;
};

export function createApp({ redis }: CreateAppOptions) {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use(createHealthRouter({ redis }));

    app.use((_req, res) => {
        res.status(404).json({
            ok: false,
            error: "Route not found"
        });
    });

    return app;
}