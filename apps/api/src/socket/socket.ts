import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import type { RaidService } from "../raids/raid.service.js";
import type { BattleInputKey, Raid } from "../raids/raid.types.js";
import { isBossId } from "../raids/boss.config.js";
import type {
    BattleAttackPayload,
    BattleInputPayload,
    ClientToServerEvents,
    JoinPlayerPayload,
    JoinRaidRoomPayload,
    PlayerReadyPayload,
    SelectRaidBossPayload,
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
type MissedNotesResolutionTimers = Map<string, ReturnType<typeof setInterval>>;

const MISSED_NOTES_RESOLUTION_INTERVAL_MS = 250;

export function setupSocketServer({
                                      httpServer,
                                      raidService
                                  }: SetupSocketServerOptions): RaidSocketServer {
    const battleFinalizationTimers: BattleFinalizationTimers = new Map();
    const missedNotesResolutionTimers: MissedNotesResolutionTimers = new Map();

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
                    finalizationTimers: battleFinalizationTimers,
                    missedNotesTimers: missedNotesResolutionTimers
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

        socket.on("raid:selectBoss", async (payload) => {
            try {
                const parsedPayload = parseSelectRaidBossPayload(payload);

                if (!parsedPayload) {
                    emitSocketError(socket, {
                        code: "invalid_payload",
                        message: "raidId, telegramUserId and valid bossId are required"
                    });
                    return;
                }

                const result = await raidService.selectRaidBoss(parsedPayload);

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
                    finalizationTimers: battleFinalizationTimers,
                    missedNotesTimers: missedNotesResolutionTimers
                });

                scheduleMissedNotesResolution({
                    io,
                    raidService,
                    raid: result.raid,
                    finalizationTimers: battleFinalizationTimers,
                    missedNotesTimers: missedNotesResolutionTimers
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
                    const handled = await handleFailedBattleAction({
                        io,
                        socket,
                        raidService,
                        raidId: parsedPayload.raidId,
                        reason: result.reason,
                        finalizationTimers: battleFinalizationTimers,
                        missedNotesTimers: missedNotesResolutionTimers
                    });

                    if (handled) {
                        return;
                    }

                    emitSocketError(socket, {
                        code: result.reason,
                        message: result.reason
                    });
                    return;
                }

                handleSuccessfulBattleAction({
                    io,
                    raid: result.raid,
                    finalizationTimers: battleFinalizationTimers,
                    missedNotesTimers: missedNotesResolutionTimers
                });
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
                    const handled = await handleFailedBattleAction({
                        io,
                        socket,
                        raidService,
                        raidId: parsedPayload.raidId,
                        reason: result.reason,
                        finalizationTimers: battleFinalizationTimers,
                        missedNotesTimers: missedNotesResolutionTimers
                    });

                    if (handled) {
                        return;
                    }

                    emitSocketError(socket, {
                        code: result.reason,
                        message: result.reason
                    });
                    return;
                }

                handleSuccessfulBattleAction({
                    io,
                    raid: result.raid,
                    finalizationTimers: battleFinalizationTimers,
                    missedNotesTimers: missedNotesResolutionTimers
                });
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

function handleSuccessfulBattleAction({
                                          io,
                                          raid,
                                          finalizationTimers,
                                          missedNotesTimers
                                      }: {
    io: RaidSocketServer;
    raid: Raid;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): void {
    if (raid.status === "finished") {
        clearRaidBattleTimers({
            raidId: raid.id,
            finalizationTimers,
            missedNotesTimers
        });
    }

    emitRaidStateToRoom(io, raid);
}

async function handleFailedBattleAction({
                                            io,
                                            socket,
                                            raidService,
                                            raidId,
                                            reason,
                                            finalizationTimers,
                                            missedNotesTimers
                                        }: {
    io: RaidSocketServer;
    socket: RaidSocket;
    raidService: RaidService;
    raidId: string;
    reason: string;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): Promise<boolean> {
    if (reason === "battle_expired") {
        return finalizeBattleIfExpired({
            io,
            raidService,
            raidId,
            finalizationTimers,
            missedNotesTimers
        });
    }

    if (reason === "player_defeated" || reason === "no_active_battle") {
        const emitted = await emitCurrentRaidStateIfFinished({
            io,
            socket,
            raidService,
            raidId,
            finalizationTimers,
            missedNotesTimers
        });

        if (emitted) {
            return true;
        }
    }

    return false;
}

async function finalizeBattleIfExpired({
                                           io,
                                           raidService,
                                           raidId,
                                           finalizationTimers,
                                           missedNotesTimers
                                       }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raidId: string;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): Promise<boolean> {
    const finalizeResult = await raidService.finalizeExpiredBattle(raidId);

    if (!finalizeResult.ok) {
        return false;
    }

    clearRaidBattleTimers({
        raidId,
        finalizationTimers,
        missedNotesTimers
    });

    emitRaidStateToRoom(io, finalizeResult.raid);

    return true;
}

async function emitCurrentRaidStateIfFinished({
                                                  io,
                                                  socket,
                                                  raidService,
                                                  raidId,
                                                  finalizationTimers,
                                                  missedNotesTimers
                                              }: {
    io: RaidSocketServer;
    socket: RaidSocket;
    raidService: RaidService;
    raidId: string;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): Promise<boolean> {
    const raid = await raidService.getRaid(raidId);

    if (!raid) {
        return false;
    }

    if (raid.status !== "finished") {
        emitRaidStateToSocket(socket, raid);
        return false;
    }

    clearRaidBattleTimers({
        raidId,
        finalizationTimers,
        missedNotesTimers
    });

    emitRaidStateToRoom(io, raid);

    return true;
}

async function finalizeExpiredBattleIfNeeded({
                                                 io,
                                                 raidService,
                                                 raid,
                                                 finalizationTimers,
                                                 missedNotesTimers
                                             }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raid: Raid;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): Promise<{ raid: Raid; finalized: boolean }> {
    if (!isActiveBattleRaid(raid)) {
        clearRaidBattleTimers({
            raidId: raid.id,
            finalizationTimers,
            missedNotesTimers
        });

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
            finalizationTimers,
            missedNotesTimers
        });

        scheduleMissedNotesResolution({
            io,
            raidService,
            raid,
            finalizationTimers,
            missedNotesTimers
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

    clearRaidBattleTimers({
        raidId: raid.id,
        finalizationTimers,
        missedNotesTimers
    });

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
                                        finalizationTimers,
                                        missedNotesTimers
                                    }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raid: Raid;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): void {
    if (!isActiveBattleRaid(raid)) {
        clearBattleFinalizationTimer(finalizationTimers, raid.id);
        return;
    }

    clearBattleFinalizationTimer(finalizationTimers, raid.id);

    const delayMs = Math.max(0, raid.battle.endsAt - Date.now());

    const timerId = setTimeout(() => {
        void finalizeBattleByTimer({
            io,
            raidService,
            raidId: raid.id,
            finalizationTimers,
            missedNotesTimers
        });
    }, delayMs + 50);

    finalizationTimers.set(raid.id, timerId);

    console.log("[socket] scheduled battle finalization:", {
        raidId: raid.id,
        delayMs
    });
}

function scheduleMissedNotesResolution({
                                           io,
                                           raidService,
                                           raid,
                                           finalizationTimers,
                                           missedNotesTimers
                                       }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raid: Raid;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): void {
    if (!isActiveBattleRaid(raid)) {
        clearMissedNotesResolutionTimer(missedNotesTimers, raid.id);
        return;
    }

    clearMissedNotesResolutionTimer(missedNotesTimers, raid.id);

    const timerId = setInterval(() => {
        void resolveMissedNotesByTimer({
            io,
            raidService,
            raidId: raid.id,
            finalizationTimers,
            missedNotesTimers
        });
    }, MISSED_NOTES_RESOLUTION_INTERVAL_MS);

    missedNotesTimers.set(raid.id, timerId);

    console.log("[socket] scheduled missed notes resolution:", {
        raidId: raid.id,
        intervalMs: MISSED_NOTES_RESOLUTION_INTERVAL_MS
    });
}

async function finalizeBattleByTimer({
                                         io,
                                         raidService,
                                         raidId,
                                         finalizationTimers,
                                         missedNotesTimers
                                     }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raidId: string;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): Promise<void> {
    const result = await raidService.finalizeExpiredBattle(raidId);

    if (result.ok) {
        clearRaidBattleTimers({
            raidId,
            finalizationTimers,
            missedNotesTimers
        });

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
                finalizationTimers,
                missedNotesTimers
            });

            scheduleMissedNotesResolution({
                io,
                raidService,
                raid,
                finalizationTimers,
                missedNotesTimers
            });
        }

        return;
    }

    clearRaidBattleTimers({
        raidId,
        finalizationTimers,
        missedNotesTimers
    });

    console.log("[socket] battle finalization skipped:", {
        raidId,
        reason: result.reason
    });
}

async function resolveMissedNotesByTimer({
                                             io,
                                             raidService,
                                             raidId,
                                             finalizationTimers,
                                             missedNotesTimers
                                         }: {
    io: RaidSocketServer;
    raidService: RaidService;
    raidId: string;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): Promise<void> {
    const result = await raidService.resolveMissedNotes({
        raidId
    });

    if (!result.ok) {
        clearRaidBattleTimers({
            raidId,
            finalizationTimers,
            missedNotesTimers
        });

        console.log("[socket] missed notes resolution stopped:", {
            raidId,
            reason: result.reason
        });

        const raid = await raidService.getRaid(raidId);

        if (raid?.status === "finished") {
            emitRaidStateToRoom(io, raid);
        }

        return;
    }

    if (result.raid.status === "finished") {
        clearRaidBattleTimers({
            raidId,
            finalizationTimers,
            missedNotesTimers
        });

        emitRaidStateToRoom(io, result.raid);
        return;
    }

    if (result.resolvedCount > 0) {
        emitRaidStateToRoom(io, result.raid);
    }
}

function clearRaidBattleTimers({
                                   raidId,
                                   finalizationTimers,
                                   missedNotesTimers
                               }: {
    raidId: string;
    finalizationTimers: BattleFinalizationTimers;
    missedNotesTimers: MissedNotesResolutionTimers;
}): void {
    clearBattleFinalizationTimer(finalizationTimers, raidId);
    clearMissedNotesResolutionTimer(missedNotesTimers, raidId);
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

function clearMissedNotesResolutionTimer(
    timers: MissedNotesResolutionTimers,
    raidId: string
): void {
    const existingTimer = timers.get(raidId);

    if (!existingTimer) {
        return;
    }

    clearInterval(existingTimer);
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

function parseSelectRaidBossPayload(
    payload: SelectRaidBossPayload
): SelectRaidBossPayload | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (typeof payload.raidId !== "string") {
        return null;
    }

    if (typeof payload.telegramUserId !== "string") {
        return null;
    }

    if (typeof payload.bossId !== "string") {
        return null;
    }

    const raidId = payload.raidId.trim();
    const telegramUserId = payload.telegramUserId.trim();
    const bossId = payload.bossId.trim();

    if (!raidId || !telegramUserId || !isBossId(bossId)) {
        return null;
    }

    return {
        raidId,
        telegramUserId,
        bossId
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