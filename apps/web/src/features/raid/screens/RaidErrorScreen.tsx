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
    isCreatingRaid?: boolean;
    onRetry: () => void;
    onCreateRaid?: () => void;
};

export function RaidErrorScreen({
                                    raidId,
                                    chatId,
                                    currentUser,
                                    socketStatus,
                                    socketError,
                                    gameError,
                                    message,
                                    isCreatingRaid = false,
                                    onRetry,
                                    onCreateRaid
                                }: RaidErrorScreenProps) {
    const errorView = getErrorView(message);
    const canCreateRaid = Boolean(chatId && onCreateRaid);

    return (
        <main className="raid-prep-page raid-error-page">
            <section className="raid-prep-card raid-error-card">
                <header className="raid-prep-header raid-error-header">
                    <div>
                        <p className="eyebrow">Telegram Raid Lobby</p>
                        <h1>{errorView.title}</h1>
                    </div>

                    <div className="status-pill raid-error-pill">Error</div>
                </header>

                {gameError && <div className="game-error-banner">{gameError}</div>}

                <section className="raid-error-hero" aria-label="Raid error summary">
                    <div className="raid-error-emblem" aria-hidden="true">
                        {errorView.icon}
                    </div>

                    <div className="raid-error-copy">
                        <span>{errorView.kicker}</span>
                        <h2>{errorView.heading}</h2>
                        <p>{errorView.description}</p>
                    </div>
                </section>

                <section className="raid-error-details">
                    <div>
                        <p className="eyebrow">Server response</p>
                        <h2>{formatErrorMessage(message)}</h2>
                    </div>

                    <p>{errorView.recoveryHint}</p>
                </section>

                <section className="raid-error-actions" aria-label="Raid recovery actions">
                    {canCreateRaid && (
                        <button
                            className="primary-button raid-error-primary-action"
                            type="button"
                            disabled={isCreatingRaid}
                            onClick={onCreateRaid}
                        >
                            {isCreatingRaid ? "Creating..." : "Create new raid"}
                        </button>
                    )}

                    <button
                        className="secondary-button raid-error-secondary-action"
                        type="button"
                        disabled={isCreatingRaid}
                        onClick={onRetry}
                    >
                        Retry loading
                    </button>
                </section>

                <details className="raid-debug-details">
                    <summary>Connection details</summary>

                    <RaidMetaPanel
                        raidId={raidId}
                        chatId={chatId}
                        currentUser={currentUser}
                        socketStatus={socketStatus}
                        socketError={socketError}
                        gameError={gameError}
                    />
                </details>
            </section>
        </main>
    );
}

function getErrorView(message: string): {
    icon: string;
    kicker: string;
    title: string;
    heading: string;
    description: string;
    recoveryHint: string;
} {
    const normalizedMessage = message.toLowerCase();

    if (
        normalizedMessage.includes("raid_not_found") ||
        normalizedMessage.includes("not found") ||
        normalizedMessage.includes("expired")
    ) {
        return {
            icon: "⌛",
            kicker: "Raid expired",
            title: "Raid expired",
            heading: "This lobby is no longer active",
            description:
                "The raid link points to a lobby that was already removed from the server.",
            recoveryHint:
                "Create a fresh raid for this Telegram chat instead of trying to revive the old link."
        };
    }

    return {
        icon: "⚠️",
        kicker: "Raid error",
        title: "Raid error",
        heading: "Something blocked this raid",
        description:
            "The app could not load the current raid state from the backend.",
        recoveryHint:
            "Retry loading first. If the raid was deleted or expired, create a new one."
    };
}

function formatErrorMessage(message: string): string {
    return message
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}