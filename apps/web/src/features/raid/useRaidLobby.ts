import { useCallback, useEffect, useMemo, useState } from "react";
import type { CurrentUser, RaidState } from "./types";
import { joinRaidApi, loadRaidApi, setReadyApi, startRaidApi } from "./raidApi";

type UseRaidLobbyOptions = {
    raidId: string | null;
    currentUser: CurrentUser;
};

export function useRaidLobby({ raidId, currentUser }: UseRaidLobbyOptions) {
    const [raidState, setRaidState] = useState<RaidState>({ status: "idle" });
    const [isJoining, setIsJoining] = useState(false);
    const [isReadyUpdating, setIsReadyUpdating] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [localNow, setLocalNow] = useState(Date.now());

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
        }, 1000);

        return () => {
            window.clearInterval(timerId);
        };
    }, []);

    useEffect(() => {
        if (!raidId) {
            return;
        }

        void loadRaid(raidId);
    }, [raidId, loadRaid]);

    async function joinRaid() {
        if (!raidId) {
            return;
        }

        setIsJoining(true);

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
    }

    async function setReady(isReady: boolean) {
        if (!raidId) {
            return;
        }

        setIsReadyUpdating(true);

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
    }

    async function startRaid() {
        if (!raidId) {
            return;
        }

        setIsStarting(true);

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
    }

    return {
        raidState,
        raid,
        players,
        currentPlayer,
        readyPlayersCount,
        canStart,
        localNow,
        isJoining,
        isReadyUpdating,
        isStarting,
        loadRaid,
        joinRaid,
        setReady,
        startRaid
    };
}