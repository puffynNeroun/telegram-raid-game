import { useEffect, useMemo } from "react";
import { getCurrentUser, initTelegramWebApp } from "./telegram";
import { useRaidLobby } from "./useRaidLobby";
import { RaidBattleScreen } from "./screens/RaidBattleScreen";
import { RaidErrorScreen } from "./screens/RaidErrorScreen";
import { RaidLobbyScreen } from "./screens/RaidLobbyScreen";
import { RaidLoadingScreen } from "./screens/RaidLoadingScreen";
import { RaidMissingScreen } from "./screens/RaidMissingScreen";
import { RaidResultScreen } from "./screens/RaidResultScreen";

export function RaidGame() {
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const raidId = params.get("raidId");
    const chatId = params.get("chatId");

    const currentUser = useMemo(() => getCurrentUser(params), [params]);

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

    useEffect(() => {
        initTelegramWebApp();
    }, []);

    if (!raidId) {
        return <RaidMissingScreen />;
    }

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

    const battle = raid.battle;
    const refreshRaid = () => {
        void loadRaid(raidId);
    };

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
