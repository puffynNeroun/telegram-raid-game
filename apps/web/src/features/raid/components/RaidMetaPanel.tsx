import type { CurrentUser, SocketStatus } from "../types";

type RaidMetaPanelProps = {
    raidId: string;
    chatId: string | null;
    currentUser: CurrentUser;
    socketStatus: SocketStatus;
    socketError: string | null;
    gameError: string | null;
};

export function RaidMetaPanel({
                                  raidId,
                                  chatId,
                                  currentUser,
                                  socketStatus,
                                  socketError,
                                  gameError
                              }: RaidMetaPanelProps) {
    return (
        <div className="raid-meta">
            <p>
                Raid ID: <span>{raidId}</span>
            </p>

            {chatId && (
                <p>
                    Chat ID: <span>{chatId}</span>
                </p>
            )}

            <p>
                You: <span>{currentUser.displayName}</span>
            </p>

            <p>
                User source: <span>{currentUser.source}</span>
            </p>

            <p>
                Realtime: <span>{socketStatus}</span>
            </p>

            {socketError && (
                <p>
                    Connection error: <span>{socketError}</span>
                </p>
            )}

            {gameError && (
                <p>
                    Game warning: <span>{gameError}</span>
                </p>
            )}
        </div>
    );
}
