import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
    BattleInputKey,
    ClientToServerEvents,
    CurrentUser,
    RaidState,
    ServerToClientEvents,
    SocketStatus
} from "./types";
import { joinRaidApi, loadRaidApi, setReadyApi, startRaidApi } from "./raidApi";

type UseRaidLobbyOptions = {
    raidId: string | null;
    currentUser: CurrentUser;
};

type RaidLobbySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const socketUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const LOCAL_CLOCK_INTERVAL_MS = 50;

export function useRaidLobby({ raidId, currentUser }: UseRaidLobbyOptions) {
    const socketRef = useRef<RaidLobbySocket | null>(null);

    const [raidState, setRaidState] = useState<RaidState>({ status: "idle" });
    const [socketStatus, setSocketStatus] = useState<SocketStatus>("idle");
    const [socketError, setSocketError] = useState<string | null>(null);
    const [gameError, setGameError] = useState<string | null>(null);

    const [isJoining, setIsJoining] = useState(false);
    const [isReadyUpdating, setIsReadyUpdating] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isInputSending, setIsInputSending] = useState(false);

    const [localNow, setLocalNow] = useState(0);

    const raid = raidState.status === "loaded" ? raidState.raid : null;

    const players = useMemo(() => {
        return raid ? Object.values(raid.players) : [];
    }, [raid]);

    const currentPlayer = raid?.players[currentUser.id] ?? null;

    const readyPlayersCount = useMemo(() => {
        return players.filter((player) => player.isReady).length;
    }, [players]);

    const canStart = Boolean(
        raid?.status === "lobby" && currentPlayer?.isHost && readyPlayersCount >= 1
    );

    const effectiveSocketStatus: SocketStatus =
        raidId && socketStatus === "idle" ? "connecting" : socketStatus;

    const loadRaid = useCallback(
        async (nextRaidId = raidId) => {
            if (!nextRaidId) {
                return;
            }

            setRaidState({ status: "loading" });

            try {
                const result = await loadRaidApi(nextRaidId);

                setRaidState({
                    status: "loaded",
                    raid: result.raid,
                    serverTime: result.serverTime
                });
            } catch (error) {
                setRaidState({
                    status: "error",
                    message: error instanceof Error ? error.message : "Unknown error"
                });
            }
        },
        [raidId]
    );

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setLocalNow(Date.now());
        }, LOCAL_CLOCK_INTERVAL_MS);

        return () => {
            window.clearInterval(timerId);
        };
    }, []);

    useEffect(() => {
        if (!raidId) {
            return;
        }

        const timerId = window.setTimeout(() => {
            void loadRaid(raidId);
        }, 0);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [raidId, loadRaid]);

    useEffect(() => {
        if (!raidId) {
            return;
        }

        const socket: RaidLobbySocket = io(socketUrl, {
            transports: ["websocket", "polling"]
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            setSocketStatus("connected");
            setSocketError(null);
            setGameError(null);

            socket.emit("raid:joinRoom", {
                raidId
            });
        });

        socket.on("disconnect", () => {
            setSocketStatus("disconnected");
        });

        socket.on("connect_error", (error) => {
            setSocketStatus("error");
            setSocketError(error.message);
        });

        socket.on("raid:state", (payload) => {
            setRaidState({
                status: "loaded",
                raid: payload.raid,
                serverTime: payload.serverTime
            });

            setIsJoining(false);
            setIsReadyUpdating(false);
            setIsStarting(false);
            setIsInputSending(false);
            setGameError(null);
        });

        socket.on("socket:error", (payload) => {
            setGameError(payload.message);

            setIsJoining(false);
            setIsReadyUpdating(false);
            setIsStarting(false);
            setIsInputSending(false);
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("connect_error");
            socket.off("raid:state");
            socket.off("socket:error");

            socket.disconnect();

            if (socketRef.current === socket) {
                socketRef.current = null;
            }
        };
    }, [raidId]);

    const joinRaid = useCallback(async () => {
        if (!raidId) {
            return;
        }

        setIsJoining(true);
        setGameError(null);

        const socket = socketRef.current;

        if (socket?.connected) {
            socket.emit("player:join", {
                raidId,
                telegramUserId: currentUser.id,
                displayName: currentUser.displayName
            });

            return;
        }

        try {
            const result = await joinRaidApi({
                raidId,
                telegramUserId: currentUser.id,
                displayName: currentUser.displayName
            });

            setRaidState({
                status: "loaded",
                raid: result.raid,
                serverTime: Date.now()
            });
        } catch (error) {
            setRaidState({
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        } finally {
            setIsJoining(false);
        }
    }, [currentUser.displayName, currentUser.id, raidId]);

    const setReady = useCallback(
        async (isReady: boolean) => {
            if (!raidId) {
                return;
            }

            setIsReadyUpdating(true);
            setGameError(null);

            const socket = socketRef.current;

            if (socket?.connected) {
                socket.emit("player:ready", {
                    raidId,
                    telegramUserId: currentUser.id,
                    isReady
                });

                return;
            }

            try {
                const result = await setReadyApi({
                    raidId,
                    telegramUserId: currentUser.id,
                    isReady
                });

                setRaidState({
                    status: "loaded",
                    raid: result.raid,
                    serverTime: Date.now()
                });
            } catch (error) {
                setRaidState({
                    status: "error",
                    message: error instanceof Error ? error.message : "Unknown error"
                });
            } finally {
                setIsReadyUpdating(false);
            }
        },
        [currentUser.id, raidId]
    );

    const startRaid = useCallback(async () => {
        if (!raidId) {
            return;
        }

        setIsStarting(true);
        setGameError(null);

        const socket = socketRef.current;

        if (socket?.connected) {
            socket.emit("raid:start", {
                raidId,
                telegramUserId: currentUser.id
            });

            return;
        }

        try {
            const result = await startRaidApi({
                raidId,
                telegramUserId: currentUser.id
            });

            setRaidState({
                status: "loaded",
                raid: result.raid,
                serverTime: Date.now()
            });
        } catch (error) {
            setRaidState({
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        } finally {
            setIsStarting(false);
        }
    }, [currentUser.id, raidId]);

    const sendBattleInput = useCallback(
        (key: BattleInputKey) => {
            if (!raidId) {
                return;
            }

            const socket = socketRef.current;

            if (!socket?.connected) {
                setSocketStatus("error");
                setSocketError("Realtime connection is required for battle input");
                setIsInputSending(false);
                return;
            }

            setIsInputSending(true);
            setGameError(null);

            socket.emit("battle:input", {
                raidId,
                telegramUserId: currentUser.id,
                key
            });
        },
        [currentUser.id, raidId]
    );

    return {
        raidState,
        raid,
        players,
        currentPlayer,
        readyPlayersCount,
        canStart,
        localNow,
        socketStatus: effectiveSocketStatus,
        socketError,
        gameError,
        isJoining,
        isReadyUpdating,
        isStarting,
        isInputSending,
        loadRaid,
        joinRaid,
        setReady,
        startRaid,
        sendBattleInput
    };
}