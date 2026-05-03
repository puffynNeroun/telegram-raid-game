import { BossPanel } from "../components/BossPanel";
import { RaidMetaPanel } from "../components/RaidMetaPanel";
import type { CurrentUser, SocketStatus } from "../types";

type RaidLoadingScreenProps = {
    raidId: string;
    chatId: string | null;
    currentUser: CurrentUser;
    socketStatus: SocketStatus;
    socketError: string | null;
    gameError: string | null;
};

export function RaidLoadingScreen({
                                      raidId,
                                      chatId,
                                      currentUser,
                                      socketStatus,
                                      socketError,
                                      gameError
                                  }: RaidLoadingScreenProps) {
    return (
        <main className="app-shell">
            <section className="game-card">
                <header className="game-header">
                    <div>
                        <p className="eyebrow">Telegram Raid Lobby</p>
                        <h1>Boss Raid</h1>
                    </div>

                    <div className="status-pill">Loading</div>
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

                <section className="panel">
                    <h3>Loading raid...</h3>
                    <p className="muted">Fetching raid state from the API.</p>
                </section>
            </section>
        </main>
    );
}
