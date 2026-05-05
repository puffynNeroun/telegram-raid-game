import { useEffect, useMemo, useRef, useState } from "react";
import { createRaidApi } from "./raidApi";
import { getCurrentUser, getTelegramStartParam, initTelegramWebApp } from "./telegram";
import { useRaidLobby } from "./useRaidLobby";
import { RaidBattleScreen } from "./screens/RaidBattleScreen";
import { RaidBeatdownScreen } from "./screens/RaidBeatdownScreen";
import { RaidErrorScreen } from "./screens/RaidErrorScreen";
import { RaidLobbyScreen } from "./screens/RaidLobbyScreen";
import { RaidLoadingScreen } from "./screens/RaidLoadingScreen";
import { RaidMissingScreen } from "./screens/RaidMissingScreen";
import { RaidResultScreen } from "./screens/RaidResultScreen";
import type { BattleState, BossId, Raid, RaidCombatMode } from "./types";

type BattleConclusionState = {
    raid: Raid;
    battle: BattleState;
    outcome: Exclude<BattleState["outcome"], null>;
    revealedAt: number;
};

type RaidActionErrorState = {
    raidId: string;
    message: string;
};

type CreateFollowUpRaidInput = {
    bossId: BossId;
    combatMode: RaidCombatMode;
};

const BATTLE_CONCLUSION_REVEAL_MS = 3000;
const DEFAULT_BOSS_ID: BossId = "boss-001";
const DEFAULT_COMBAT_MODE: RaidCombatMode = "rhythm";

export function RaidGame() {
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const raidId = getRaidIdFromParams(params);
    const chatId = params.get("chatId");
    const requestedCombatMode = getRequestedCombatMode(params);

    const currentUser = useMemo(() => getCurrentUser(params), [params]);

    const conclusionScheduleTimerRef =
        useRef<ReturnType<typeof window.setTimeout> | null>(null);

    const conclusionRevealTimerRef =
        useRef<ReturnType<typeof window.setTimeout> | null>(null);

    const lastActiveBattleRaidIdRef = useRef<string | null>(null);
    const lastConclusionKeyRef = useRef<string | null>(null);

    const [battleConclusion, setBattleConclusion] =
        useState<BattleConclusionState | null>(null);

    const [isCreatingRaid, setIsCreatingRaid] = useState(false);
    const [raidActionError, setRaidActionError] =
        useState<RaidActionErrorState | null>(null);

    const {
        raidState,
        raid,
        players,
        currentPlayer,
        canStart,
        bosses,
        isBossesLoading,
        bossesError,
        localNow,
        socketStatus,
        socketError,
        gameError,
        isJoining,
        isReadyUpdating,
        isBossSelecting,
        isStarting,
        isInputSending,
        loadRaid,
        joinRaid,
        setReady,
        selectBoss,
        isCombatModeSelecting,
        selectCombatMode,
        startRaid,
        sendBattleInput,
        sendBeatdownHit
    } = useRaidLobby({
        raidId,
        currentUser
    });

    const battle = raid?.battle ?? null;

    const activeBattleConclusion =
        raidId && battleConclusion?.raid.id === raidId ? battleConclusion : null;

    const activeRaidActionError =
        raidId && raidActionError?.raidId === raidId
            ? raidActionError.message
            : null;

    useEffect(() => {
        initTelegramWebApp();
    }, []);

    useEffect(() => {
        return () => {
            if (conclusionScheduleTimerRef.current) {
                window.clearTimeout(conclusionScheduleTimerRef.current);
                conclusionScheduleTimerRef.current = null;
            }

            if (conclusionRevealTimerRef.current) {
                window.clearTimeout(conclusionRevealTimerRef.current);
                conclusionRevealTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!raidId) {
            return;
        }

        lastActiveBattleRaidIdRef.current = null;
        lastConclusionKeyRef.current = null;

        if (conclusionScheduleTimerRef.current) {
            window.clearTimeout(conclusionScheduleTimerRef.current);
            conclusionScheduleTimerRef.current = null;
        }

        if (conclusionRevealTimerRef.current) {
            window.clearTimeout(conclusionRevealTimerRef.current);
            conclusionRevealTimerRef.current = null;
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
            return;
        }

        const outcome = getBattleOutcome(battle);
        const conclusionKey = `${raid.id}:${battle.endsAt}:${outcome}`;

        if (lastConclusionKeyRef.current === conclusionKey) {
            return;
        }

        lastConclusionKeyRef.current = conclusionKey;

        if (conclusionScheduleTimerRef.current) {
            window.clearTimeout(conclusionScheduleTimerRef.current);
            conclusionScheduleTimerRef.current = null;
        }

        if (conclusionRevealTimerRef.current) {
            window.clearTimeout(conclusionRevealTimerRef.current);
            conclusionRevealTimerRef.current = null;
        }

        const conclusion: BattleConclusionState = {
            raid,
            battle,
            outcome,
            revealedAt: Date.now()
        };

        const scheduleTimerId = window.setTimeout(() => {
            if (lastConclusionKeyRef.current !== conclusionKey) {
                return;
            }

            setBattleConclusion((currentConclusion) => {
                if (
                    currentConclusion?.raid.id === raid.id &&
                    currentConclusion.battle.endsAt === battle.endsAt &&
                    currentConclusion.outcome === outcome
                ) {
                    return currentConclusion;
                }

                return conclusion;
            });

            if (conclusionScheduleTimerRef.current === scheduleTimerId) {
                conclusionScheduleTimerRef.current = null;
            }

            const revealTimerId = window.setTimeout(() => {
                setBattleConclusion((currentConclusion) => {
                    if (currentConclusion?.raid.id !== raid.id) {
                        return currentConclusion;
                    }

                    return null;
                });

                if (lastActiveBattleRaidIdRef.current === raid.id) {
                    lastActiveBattleRaidIdRef.current = null;
                }

                if (conclusionRevealTimerRef.current === revealTimerId) {
                    conclusionRevealTimerRef.current = null;
                }
            }, BATTLE_CONCLUSION_REVEAL_MS);

            conclusionRevealTimerRef.current = revealTimerId;
        }, 0);

        conclusionScheduleTimerRef.current = scheduleTimerId;
    }, [raid, battle]);

    if (!raidId) {
        return <RaidMissingScreen />;
    }

    const refreshRaid = () => {
        void loadRaid(raidId);
    };

    const createRaidForChat = async (input: {
        telegramChatId: string;
        bossId: BossId;
        combatMode: RaidCombatMode;
        errorOwnerRaidId: string;
    }) => {
        if (isCreatingRaid) {
            return;
        }

        setIsCreatingRaid(true);
        setRaidActionError(null);

        try {
            const result = await createRaidApi({
                telegramChatId: input.telegramChatId,
                hostTelegramUserId: currentUser.id,
                hostDisplayName: currentUser.displayName,
                bossId: input.bossId,
                combatMode: input.combatMode
            });

            openRaid({
                raidId: result.raid.id,
                chatId: result.raid.telegramChatId
            });
        } catch (error) {
            setRaidActionError({
                raidId: input.errorOwnerRaidId,
                message: getErrorMessage(error)
            });
        } finally {
            setIsCreatingRaid(false);
        }
    };

    const createFreshRaidFromExpiredLink = () => {
        if (!chatId) {
            return;
        }

        void createRaidForChat({
            telegramChatId: chatId,
            bossId: DEFAULT_BOSS_ID,
            combatMode: requestedCombatMode,
            errorOwnerRaidId: raidId
        });
    };

    const createFollowUpRaid = async ({
                                          bossId,
                                          combatMode
                                      }: CreateFollowUpRaidInput) => {
        if (!raid) {
            return;
        }

        await createRaidForChat({
            telegramChatId: raid.telegramChatId,
            bossId,
            combatMode,
            errorOwnerRaidId: raid.id
        });
    };

    const retryCurrentBoss = () => {
        if (!raid) {
            return;
        }

        void createFollowUpRaid({
            bossId: raid.bossId,
            combatMode: raid.combatMode ?? DEFAULT_COMBAT_MODE
        });
    };

    const createNewRaid = () => {
        if (!raid) {
            return;
        }

        void createFollowUpRaid({
            bossId: raid.bossId,
            combatMode: raid.combatMode ?? DEFAULT_COMBAT_MODE
        });
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
                message={activeRaidActionError ?? raidState.message}
                isCreatingRaid={isCreatingRaid}
                onRetry={() => {
                    void loadRaid(raidId);
                }}
                onCreateRaid={chatId ? createFreshRaidFromExpiredLink : undefined}
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
                message={activeRaidActionError ?? "Raid state is missing."}
                isCreatingRaid={isCreatingRaid}
                onRetry={() => {
                    void loadRaid(raidId);
                }}
                onCreateRaid={chatId ? createFreshRaidFromExpiredLink : undefined}
            />
        );
    }

    if (activeBattleConclusion) {
        if (activeBattleConclusion.battle.combatMode === "beatdown") {
            return (
                <RaidBeatdownScreen
                    raid={activeBattleConclusion.raid}
                    battle={activeBattleConclusion.battle}
                    raidId={raidId}
                    chatId={chatId}
                    currentUser={currentUser}
                    players={Object.values(activeBattleConclusion.raid.players)}
                    localNow={localNow}
                    socketStatus={socketStatus}
                    socketError={socketError}
                    gameError={gameError}
                    isInputSending={false}
                    onRefresh={refreshRaid}
                    onBeatdownHit={sendBeatdownHit}
                />
            );
        }

        return (
            <RaidBattleScreen
                raid={activeBattleConclusion.raid}
                battle={activeBattleConclusion.battle}
                raidId={raidId}
                chatId={chatId}
                currentUser={currentUser}
                players={Object.values(activeBattleConclusion.raid.players)}
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
                isCreatingRaid={isCreatingRaid}
                raidActionError={activeRaidActionError}
                onRefresh={refreshRaid}
                onRetryBoss={retryCurrentBoss}
                onCreateNewRaid={createNewRaid}
            />
        );
    }

    if (battle && raid.status === "battle") {
        if (battle.combatMode === "beatdown") {
            return (
                <RaidBeatdownScreen
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
                    onBeatdownHit={sendBeatdownHit}
                />
            );
        }

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
            bosses={bosses}
            isBossesLoading={isBossesLoading}
            bossesError={bossesError}
            localNow={localNow}
            socketStatus={socketStatus}
            socketError={socketError}
            gameError={gameError}
            isJoining={isJoining}
            isCombatModeSelecting={isCombatModeSelecting}
            onSelectCombatMode={selectCombatMode}
            isReadyUpdating={isReadyUpdating}
            isBossSelecting={isBossSelecting}
            isStarting={isStarting}
            onRefresh={refreshRaid}
            onJoin={joinRaid}
            onReadyChange={setReady}
            onSelectBoss={selectBoss}
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

function getRequestedCombatMode(params: URLSearchParams): RaidCombatMode {
    const combatMode = params.get("combatMode");

    if (combatMode === "beatdown" || combatMode === "rhythm") {
        return combatMode;
    }

    return DEFAULT_COMBAT_MODE;
}

function openRaid(input: { raidId: string; chatId: string }) {
    const nextParams = new URLSearchParams(window.location.search);

    nextParams.set("raidId", input.raidId);
    nextParams.set("chatId", input.chatId);

    window.location.assign(`${window.location.pathname}?${nextParams.toString()}`);
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Failed to create a new raid.";
}
function getRaidIdFromParams(params: URLSearchParams): string | null {
    const directRaidId = params.get("raidId");

    if (directRaidId) {
        return directRaidId;
    }

    const startParam = getTelegramStartParam(params);

    if (!startParam) {
        return null;
    }

    const match = startParam.match(/^raid_([A-Za-z0-9_-]+)$/);

    return match?.[1] ?? null;
}