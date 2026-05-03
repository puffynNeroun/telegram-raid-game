import { BossPanel } from "../components/BossPanel";
import { RaidMetaPanel } from "../components/RaidMetaPanel";
import type { CurrentUser, SocketStatus } from "../types";

type RaidErrorScreenProps = {
    raidId: string;
    chatId: string | null;
    currentUser: CurrentUser;
    socketStatus: SocketStatus;
    socketError: string | null;
    gameError: string | null;
    message: string;
    onRetry: () => void;
};

export function RaidErrorScreen({
                                    raidId,
                                    chatId,
                                    currentUser,
                                    socketStatus,
                                    socketError,
                                    gameError,
                                    message,
                                    onRetry
                                }: RaidErrorScreenProps) {
    return (
        <main className="app-shell">
            <section className="game-card">
                <header className="game-header">
                    <div>
                        <p className="eyebrow">Telegram Raid Lobby</p>
                        <h1>Boss Raid</h1>
                    </div>

                    <div className="status-pill">Error</div>
                </header>

                <BossPanel battle={null} raidStatus={null} />

                <RaidMetaPanel
                    raidId={raidId}
                    chatId={chatId}
                    currentUser={currentUser}
                    socketStatus={socketStatus}
                    socketError={socketError}
                    gameError={gameError}
                />

                {gameError && <div className="game-error-banner">{gameError}</div>}

                <section className="panel danger-panel">
                    <h3>Raid error</h3>
                    <p>{message}</p>
                </section>

                <div className="action-stack">
                    <button className="secondary-button" type="button" onClick={onRetry}>
                        Retry
                    </button>
                </div>
            </section>
        </main>
    );
}
