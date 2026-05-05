import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

dotenv.config({
    path: path.resolve(currentDir, "../../../../.env")
});

dotenv.config({
    path: path.resolve(currentDir, "../../.env"),
    override: true
});

export const env = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    apiPort: Number(process.env.API_PORT ?? 8080),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    telegramWebAppUrl: process.env.TELEGRAM_WEB_APP_URL ?? "https://example.com",
    telegramMiniAppUrl: process.env.TELEGRAM_MINI_APP_URL ?? ""
};

if (Number.isNaN(env.apiPort)) {
    throw new Error("API_PORT must be a valid number");
}