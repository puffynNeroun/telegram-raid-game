import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import type { RaidService } from "../raids/raid.service.js";
import type { BattleInputKey, Raid } from "../raids/raid.types.js";
import type {
    BattleAttackPayload,
    BattleInputPayload,
    ClientToServerEvents,
    JoinPlayerPayload,
    JoinRaidRoomPayload,
    PlayerReadyPayload,
    ServerToClientEvents,
    SocketErrorPayload,
    StartRaidPayload
} from "./socket.types.js";

type SetupSocketServerOptions = {
    httpServer: HttpServer;
    raidService: RaidService;
};

type RaidSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type RaidSocketServer = Server<ClientToServerEvents, ServerToClientEvents>;
type BattleFinalizationTimers = Map<string, ReturnType<typeof setTimeout>>;

export function setupSocketServer({
                                      httpServer,
                                      raidService
                                  }: SetupSocketServerOptions): RaidSocketServer {
    const battleFinalizationTimers: BattleFinalizationTimers = new Map();

    const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log("[socket] connected:", socket.id);

        socket.on("raid:joinRoom", async (payload) => {
            try {
                const raidId = getValidRaidId(payload);

                if (!raidId) {
                    emitSocketError(socket, {
                        code: "invalid_payload",
                        message: "raidId is required"
                    });
                    return;
                }

                const raid = await raidService.getRaid(raidId);

                if (!raid) {
                    emitSocketError(socket, {
                        code: "raid_not_found",
                        message: "Raid was not found or expired"
                    });
                    return;
                }

                await socket.join(getRaidRoomName(raidId));

                console.log("[socket] joined raid room:", {
                    socketId: socket.id,
                    raidId
                });

                const result = await finalizeExpiredBattleIfNeeded({
                    io,
                    raidService,
                    raid,
                    timers: battleFinalizationTimers
                });

                if (!result.finalized) {
                    emitRaidStateToSocket(socket, result.raid);
                }
            } catch (error) {
                emitInternalSocketError(socket, error);
            }
        });

        socket.on("player:join", async (payload) => {
            try {
                const parsedPayload = parseJoinPlayerPayload(payload);

                if (!parsedPayload) {
                    emitSocketError(socket, {
                        code: "invalid_payload",
                        message: "raidId, telegramUserId and displayName are required"
                    });
                    return;
                }

                const result = await raidService.joinRaid(parsedPayload);

                if (!result.ok) {
                    emitSocketError(socket, {
                        code: result.reason,
                        message: result.reason
                    });
                    return;
                }

                await socket.join(getRaidRoomName(result.raid.id));

                emitRaidStateToRoom(io, result.raid);
            } catch (error) {
                emitInternalSocketError(socket, error);
            }
        });

        socket.on("player:ready", async (payload) => {
            try {
                const parsedPayload = parsePlayerReadyPayload(payload);

                if (!parsedPayload) {
                    emitSocketError(socket, {
                        code: "invalid_payload",
                        message: "raidId, telegramUserId and isReady are required"
                    });
                    return;
                }

                const result = await raidService.setReady(parsedPayload);

                if (!result.ok) {
                    emitSocketError(socket, {
                        code: result.reason,
                        message: result.reason
                    });
                    return;
                }

                emitRaidStateToRoom(io, result.raid);
            } catch (error) {
                emitInternalSocketError(socket, error);
            }
        });

        socket.on("raid:start", async (payload) => {
            try {
                const parsedPayload = parseStartRaidPayload(payload);

                if (!parsedPayload) {
                    emitSocketError(socket, {
                        code: "invalid_payload",
                        message: "raidId and telegramUserId are required"
                    });
                    return;
                }

                const result = await raidService.startRaid(parsedPayload);

                if (!result.ok) {
                    emitSocketError(socket, {
                        code: result.reason,
                        message: result.reason
                    });
                    return;
                }

                emitRaidStateToRoom(io, result.raid);

                scheduleBattleFinalization({
                    io,
                    raidService,
                    raid: result.raid,
                    timers: battleFinalizationTimers
                });
            } catch (error) {
                emitInternalSocketError(socket, error);
            }
        });

        socket.on("battle:attack", async (payload) => {
            try {
                const parsedPayload = parseBattleAttackPayload(payload);

                if (!parsedPayload) {
                    emitSocketError(socket, {
                        code: "invalid_payload",
                        message: "raidId and telegramUserId are required"
                    });
                    return;
                }

                const result = await raidService.applyBattleAttack(parsedPayload);

                if (!result.ok) {
                    const finalized = await finalizeBattleIfExpired({
                        io,
                        raidService,
                        raidId: parsedPayload.raidId,
                        timers: battleFinalizationTimers,
                        reason: result.reason
                    });

                    if (finalized) {
                        return;
                    }

                    emitSocketError(socket, {
                        code: result.reason,
                        message: result.reason
                    });
                    return;
                }

                if (result.raid.status === "finished") {
                    clearBattleFinalizationTimer(battleFinalizationTimers, result.raid.id);
                }

                emitRaidStateToRoom(io, result.raid);
            } catch (error) {
                emitInternalSocketError(socket, error);
            }
        });

        socket.on("battle:input", async (payload) => {
            try {
                const parsedPayload = parseBattleInputPayload(payload);

                if (!parsedPayload) {
                    emitSocketError(socket, {
                        code: "invalid_payload",
                        message: "raidId, telegramUserId and valid input key are required"
                    });
                    return;
                }

                const result = await raidService.applyBattleInput(parsedPayload);

                if (!result.ok) {
                    const finalized = await finalizeBattleIfExpired({
                        io,
                        raidService,
                        raidId: parsedPayload.raidId,
                        timers: battleFinalizationTimers,
                        reason: result.reason
                    });

                    if (finalized) {
                        return;
                    }

                    emitSocketError(socket, {
                        code: result.reason,
                        message: result.reason
                    });
                    return;
                }

                if (result.raid.status === "finished") {
                    clearBattleFinalizationTimer(battleFinalizationTimers, result.raid.id);
                }

                emitRaidStateToRoom(io, result.raid);
            } catch (error) {
                emitInternalSocketError(socket, error);
            }
        });

        socket.on("disconnect", (reason) => {
            console.log("[socket] disconnected:", {
                socketId: socket.id,
                reason
            });
        });
    });

    console.log("[socket] server initialized");

    return io;
}

function getRaidRoomName(raidId: string): string {
    return `raid:${raidId}`;
}

function emitRaidStateToSocket(socket: RaidSocket, raid: Raid): void {
    socket.emit("raid:state", {
        raid,
        serverTime: Date.now()
    });
}

function emitRaidStateToRoom(io: RaidSocketServer, raid: Raid): void {
    io.to(getRaidRoomName(raid.id)).emit("raid:state", {
        raid,
        serverTime: Date.now()
    });
}

function emitSocketError(socket: RaidSocket, error: SocketErrorPayload): void {
    socket.emit("socket:error", error);
}

function emitInternalSocketError(socket: RaidSocket, error: unknown): void {
    console.error("[socket] handler error:", error);

    emitSocketError(socket, {
        code: "internal_error",
        message: "Internal server error"
    });
}

async function finalizeBattleIfExpired({
                                           io,
                                           raidService,
                                           raidId,
                                           timers,
                                           reason
                                       }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raidId: string;
    timers: BattleFinalizationTimers;
    reason: string;
}): Promise<boolean> {
    if (reason !== "battle_expired") {
        return false;
    }

    const finalizeResult = await raidService.finalizeExpiredBattle(raidId);

    if (!finalizeResult.ok) {
        return false;
    }

    clearBattleFinalizationTimer(timers, raidId);
    emitRaidStateToRoom(io, finalizeResult.raid);

    return true;
}

async function finalizeExpiredBattleIfNeeded({
                                                 io,
                                                 raidService,
                                                 raid,
                                                 timers
                                             }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raid: Raid;
    timers: BattleFinalizationTimers;
}): Promise<{ raid: Raid; finalized: boolean }> {
    if (!isActiveBattleRaid(raid)) {
        return {
            raid,
            finalized: false
        };
    }

    if (Date.now() < raid.battle.endsAt) {
        scheduleBattleFinalization({
            io,
            raidService,
            raid,
            timers
        });

        return {
            raid,
            finalized: false
        };
    }

    const result = await raidService.finalizeExpiredBattle(raid.id);

    if (!result.ok) {
        return {
            raid,
            finalized: false
        };
    }

    clearBattleFinalizationTimer(timers, raid.id);
    emitRaidStateToRoom(io, result.raid);

    return {
        raid: result.raid,
        finalized: result.finalized
    };
}

function scheduleBattleFinalization({
                                        io,
                                        raidService,
                                        raid,
                                        timers
                                    }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raid: Raid;
    timers: BattleFinalizationTimers;
}): void {
    if (!isActiveBattleRaid(raid)) {
        clearBattleFinalizationTimer(timers, raid.id);
        return;
    }

    clearBattleFinalizationTimer(timers, raid.id);

    const delayMs = Math.max(0, raid.battle.endsAt - Date.now());

    const timerId = setTimeout(() => {
        void finalizeBattleByTimer({
            io,
            raidService,
            raidId: raid.id,
            timers
        });
    }, delayMs + 50);

    timers.set(raid.id, timerId);

    console.log("[socket] scheduled battle finalization:", {
        raidId: raid.id,
        delayMs
    });
}

async function finalizeBattleByTimer({
                                         io,
                                         raidService,
                                         raidId,
                                         timers
                                     }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raidId: string;
    timers: BattleFinalizationTimers;
}): Promise<void> {
    const result = await raidService.finalizeExpiredBattle(raidId);

    if (result.ok) {
        clearBattleFinalizationTimer(timers, raidId);

        if (result.finalized) {
            console.log("[socket] battle finalized by timer:", {
                raidId
            });

            emitRaidStateToRoom(io, result.raid);
        }

        return;
    }

    if (result.reason === "battle_not_expired") {
        const raid = await raidService.getRaid(raidId);

        if (raid) {
            scheduleBattleFinalization({
                io,
                raidService,
                raid,
                timers
            });
        }

        return;
    }

    clearBattleFinalizationTimer(timers, raidId);

    console.log("[socket] battle finalization skipped:", {
        raidId,
        reason: result.reason
    });
}

function clearBattleFinalizationTimer(
    timers: BattleFinalizationTimers,
    raidId: string
): void {
    const existingTimer = timers.get(raidId);

    if (!existingTimer) {
        return;
    }

    clearTimeout(existingTimer);
    timers.delete(raidId);
}

function isActiveBattleRaid(
    raid: Raid
): raid is Raid & { battle: NonNullable<Raid["battle"]> } {
    return (
        raid.status === "battle" &&
        Boolean(raid.battle) &&
        raid.battle?.status === "active"
    );
}

function getValidRaidId(payload: JoinRaidRoomPayload): string | null {
    if (!payload || typeof payload.raidId !== "string") {
        return null;
    }

    const raidId = payload.raidId.trim();

    return raidId.length > 0 ? raidId : null;
}

function parseJoinPlayerPayload(payload: JoinPlayerPayload): JoinPlayerPayload | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (typeof payload.raidId !== "string") {
        return null;
    }

    if (typeof payload.telegramUserId !== "string") {
        return null;
    }

    if (typeof payload.displayName !== "string") {
        return null;
    }

    const raidId = payload.raidId.trim();
    const telegramUserId = payload.telegramUserId.trim();
    const displayName = payload.displayName.trim();

    if (!raidId || !telegramUserId || !displayName) {
        return null;
    }

    if (displayName.length > 64) {
        return null;
    }

    return {
        raidId,
        telegramUserId,
        displayName
    };
}

function parsePlayerReadyPayload(
    payload: PlayerReadyPayload
): PlayerReadyPayload | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (typeof payload.raidId !== "string") {
        return null;
    }

    if (typeof payload.telegramUserId !== "string") {
        return null;
    }

    if (typeof payload.isReady !== "boolean") {
        return null;
    }

    const raidId = payload.raidId.trim();
    const telegramUserId = payload.telegramUserId.trim();

    if (!raidId || !telegramUserId) {
        return null;
    }

    return {
        raidId,
        telegramUserId,
        isReady: payload.isReady
    };
}

function parseStartRaidPayload(payload: StartRaidPayload): StartRaidPayload | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (typeof payload.raidId !== "string") {
        return null;
    }

    if (typeof payload.telegramUserId !== "string") {
        return null;
    }

    const raidId = payload.raidId.trim();
    const telegramUserId = payload.telegramUserId.trim();

    if (!raidId || !telegramUserId) {
        return null;
    }

    return {
        raidId,
        telegramUserId
    };
}

function parseBattleAttackPayload(
    payload: BattleAttackPayload
): BattleAttackPayload | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (typeof payload.raidId !== "string") {
        return null;
    }

    if (typeof payload.telegramUserId !== "string") {
        return null;
    }

    const raidId = payload.raidId.trim();
    const telegramUserId = payload.telegramUserId.trim();

    if (!raidId || !telegramUserId) {
        return null;
    }

    return {
        raidId,
        telegramUserId
    };
}

function parseBattleInputPayload(
    payload: BattleInputPayload
): BattleInputPayload | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (typeof payload.raidId !== "string") {
        return null;
    }

    if (typeof payload.telegramUserId !== "string") {
        return null;
    }

    if (typeof payload.key !== "string") {
        return null;
    }

    const raidId = payload.raidId.trim();
    const telegramUserId = payload.telegramUserId.trim();
    const key = payload.key.trim();

    if (!raidId || !telegramUserId || !isBattleInputKey(key)) {
        return null;
    }

    return {
        raidId,
        telegramUserId,
        key
    };
}

function isBattleInputKey(key: string): key is BattleInputKey {
    return key === "left" || key === "up" || key === "down" || key === "right";
}