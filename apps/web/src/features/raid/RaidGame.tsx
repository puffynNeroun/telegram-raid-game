import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentUser, initTelegramWebApp } from "./telegram";
import { useRaidLobby } from "./useRaidLobby";
import { RaidBattleScreen } from "./screens/RaidBattleScreen";
import { RaidErrorScreen } from "./screens/RaidErrorScreen";
import { RaidLobbyScreen } from "./screens/RaidLobbyScreen";
import { RaidLoadingScreen } from "./screens/RaidLoadingScreen";
import { RaidMissingScreen } from "./screens/RaidMissingScreen";
import { RaidResultScreen } from "./screens/RaidResultScreen";
import type { BattleState, Raid } from "./types";

type BattleConclusionState = {
    raid: Raid;
    battle: BattleState;
    outcome: Exclude<BattleState["outcome"], null>;
    revealedAt: number;
};

const BATTLE_CONCLUSION_REVEAL_MS = 3000;

export function RaidGame() {
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const raidId = params.get("raidId");
    const chatId = params.get("chatId");

    const currentUser = useMemo(() => getCurrentUser(params), [params]);

    const conclusionTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
        null
    );

    const lastActiveBattleRaidIdRef = useRef<string | null>(null);

    const [battleConclusion, setBattleConclusion] =
        useState<BattleConclusionState | null>(null);

    const {
        raidState,
        raid,
        players,
        currentPlayer,
        canStart,
        localNow,
        socketStatus,
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
    } = useRaidLobby({
        raidId,
        currentUser
    });

    const battle = raid?.battle ?? null;

    useEffect(() => {
        initTelegramWebApp();
    }, []);

    useEffect(() => {
        return () => {
            if (conclusionTimerRef.current) {
                window.clearTimeout(conclusionTimerRef.current);
                conclusionTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!raidId) {
            return;
        }

        setBattleConclusion(null);
        lastActiveBattleRaidIdRef.current = null;

        if (conclusionTimerRef.current) {
            window.clearTimeout(conclusionTimerRef.current);
            conclusionTimerRef.current = null;
        }
    }, [raidId]);

    useEffect(() => {
        if (!raid || !battle) {
            return;
        }

        if (raid.status === "battle" && battle.status === "active") {
            lastActiveBattleRaidIdRef.current = raid.id;
        }
    }, [raid, battle]);

    useEffect(() => {
        if (!raid || !battle) {
            return;
        }

        const isFinishedBattle =
            raid.status === "finished" || battle.status === "finished";

        if (!isFinishedBattle) {
            return;
        }

        const cameFromActiveBattle = lastActiveBattleRaidIdRef.current === raid.id;

        if (!cameFromActiveBattle) {
            setBattleConclusion(null);
            return;
        }

        const outcome = getBattleOutcome(battle);

        setBattleConclusion((currentConclusion) => {
            if (
                currentConclusion?.raid.id === raid.id &&
                currentConclusion.battle.endsAt === battle.endsAt &&
                currentConclusion.outcome === outcome
            ) {
                return currentConclusion;
            }

            return {
                raid,
                battle,
                outcome,
                revealedAt: Date.now()
            };
        });

        if (conclusionTimerRef.current) {
            window.clearTimeout(conclusionTimerRef.current);
        }

        conclusionTimerRef.current = window.setTimeout(() => {
            setBattleConclusion((currentConclusion) => {
                if (currentConclusion?.raid.id !== raid.id) {
                    return currentConclusion;
                }

                return null;
            });

            if (lastActiveBattleRaidIdRef.current === raid.id) {
                lastActiveBattleRaidIdRef.current = null;
            }

            conclusionTimerRef.current = null;
        }, BATTLE_CONCLUSION_REVEAL_MS);
    }, [raid, battle]);

    if (!raidId) {
        return <RaidMissingScreen />;
    }

    const refreshRaid = () => {
        void loadRaid(raidId);
    };

    if (raidState.status === "loading" || raidState.status === "idle") {
        return (
            <RaidLoadingScreen
                raidId={raidId}
                chatId={chatId}
                currentUser={currentUser}
                socketStatus={socketStatus}
                socketError={socketError}
                gameError={gameError}
            />
        );
    }

    if (raidState.status === "error") {
        return (
            <RaidErrorScreen
                raidId={raidId}
                chatId={chatId}
                currentUser={currentUser}
                socketStatus={socketStatus}
                socketError={socketError}
                gameError={gameError}
                message={raidState.message}
                onRetry={() => {
                    void loadRaid(raidId);
                }}
            />
        );
    }

    if (!raid) {
        return (
            <RaidErrorScreen
                raidId={raidId}
                chatId={chatId}
                currentUser={currentUser}
                socketStatus={socketStatus}
                socketError={socketError}
                gameError={gameError}
                message="Raid state is missing."
                onRetry={() => {
                    void loadRaid(raidId);
                }}
            />
        );
    }

    if (battleConclusion) {
        return (
            <RaidBattleScreen
                raid={battleConclusion.raid}
                battle={battleConclusion.battle}
                raidId={raidId}
                chatId={chatId}
                currentUser={currentUser}
                players={Object.values(battleConclusion.raid.players)}
                localNow={localNow}
                socketStatus={socketStatus}
                socketError={socketError}
                gameError={gameError}
                isInputSending={false}
                onRefresh={refreshRaid}
                onBattleInput={sendBattleInput}
            />
        );
    }

    if (battle && (raid.status === "finished" || battle.status === "finished")) {
        return (
            <RaidResultScreen
                raid={raid}
                battle={battle}
                raidId={raidId}
                chatId={chatId}
                currentUser={currentUser}
                players={players}
                localNow={localNow}
                socketStatus={socketStatus}
                socketError={socketError}
                gameError={gameError}
                onRefresh={refreshRaid}
            />
        );
    }

    if (battle && raid.status === "battle") {
        return (
            <RaidBattleScreen
                raid={raid}
                battle={battle}
                raidId={raidId}
                chatId={chatId}
                currentUser={currentUser}
                players={players}
                localNow={localNow}
                socketStatus={socketStatus}
                socketError={socketError}
                gameError={gameError}
                isInputSending={isInputSending}
                onRefresh={refreshRaid}
                onBattleInput={sendBattleInput}
            />
        );
    }

    return (
        <RaidLobbyScreen
            raid={raid}
            raidId={raidId}
            chatId={chatId}
            currentUser={currentUser}
            players={players}
            currentPlayer={currentPlayer}
            canStart={canStart}
            localNow={localNow}
            socketStatus={socketStatus}
            socketError={socketError}
            gameError={gameError}
            isJoining={isJoining}
            isReadyUpdating={isReadyUpdating}
            isStarting={isStarting}
            onRefresh={refreshRaid}
            onJoin={joinRaid}
            onReadyChange={setReady}
            onStart={startRaid}
        />
    );
}

function getBattleOutcome(
    battle: BattleState
): Exclude<BattleState["outcome"], null> {
    if (battle.outcome) {
        return battle.outcome;
    }

    return battle.boss.hp <= 0 ? "win" : "lose";
}