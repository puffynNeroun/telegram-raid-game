import { Redis } from "ioredis";
import { env } from "./config/env.js";
import { createApp } from "./app.js";

const redis = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: false
});

redis.on("connect", () => {
    console.log("[redis] connected");
});

redis.on("error", (error: Error) => {
    console.error("[redis] error:", error.message);
});

const app = createApp({ redis });

const server = app.listen(env.apiPort, () => {
    console.log(`[api] running on http://localhost:${env.apiPort}`);
});

function shutdown(signal: string) {
    console.log(`[api] received ${signal}, shutting down`);

    server.close(async () => {
        await redis.quit();
        process.exit(0);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));