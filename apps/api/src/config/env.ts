import "dotenv/config";

export const env = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    apiPort: Number(process.env.API_PORT ?? 8080),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379"
};

if (Number.isNaN(env.apiPort)) {
    throw new Error("API_PORT must be a valid number");
}