import { Redis } from "ioredis";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { RaidRepository } from "./raids/raid.repository.js";
import { RaidService } from "./raids/raid.service.js";
import { startTelegramBot, type TelegramBotRuntime } from "./bot/bot.js";

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

const raidRepository = new RaidRepository(redis);
const raidService = new RaidService(raidRepository);

const app = createApp({ redis, raidService });

let telegramBot: TelegramBotRuntime | null = null;

const server = app.listen(env.apiPort, () => {
    console.log(`[api] running on http://localhost:${env.apiPort}`);
});

console.log(`[bot] token configured: ${env.telegramBotToken ? "yes" : "no"}`);

try {
    telegramBot = await startTelegramBot({
        token: env.telegramBotToken,
        webAppUrl: env.telegramWebAppUrl,
        raidService
    });
} catch (error) {
    console.error("[bot] failed to start:", error);
}

let isShuttingDown = false;

function shutdown(signal: string) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    console.log(`[api] received ${signal}, shutting down`);

    telegramBot?.stop(signal);

    server.close(() => {
        void redis.quit().finally(() => {
            process.exit(0);
        });
    });

    setTimeout(() => {
        process.exit(1);
    }, 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));