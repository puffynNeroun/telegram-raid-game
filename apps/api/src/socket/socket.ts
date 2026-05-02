import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import type { RaidService } from "../raids/raid.service.js";
import type { Raid } from "../raids/raid.types.js";
import type {
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

export function setupSocketServer({
                                      httpServer,
                                      raidService
                                  }: SetupSocketServerOptions): RaidSocketServer {
    const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log("[socket] connected:", socket.id);

        socket.on("raid:joinRoom", async (payload) => {
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

            emitRaidStateToSocket(socket, raid);
        });

        socket.on("player:join", async (payload) => {
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
        });

        socket.on("player:ready", async (payload) => {
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
        });

        socket.on("raid:start", async (payload) => {
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