export type HealthResponse = {
    ok: boolean;
    service: "api";
    redis: "up" | "down";
};