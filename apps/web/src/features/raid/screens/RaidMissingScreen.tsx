export function RaidMissingScreen() {
    return (
        <main className="app-shell">
            <section className="game-card">
                <p className="eyebrow">Raid Boss</p>
                <h1>No raid selected</h1>

                <p className="muted">
                    Open the app from the Telegram Join Raid link, or add a raidId to the URL.
                </p>

                <div className="debug-panel">
                    <span>Expected URL format:</span>
                    <code>/?raidId=abc123&amp;chatId=-100...</code>
                </div>
            </section>
        </main>
    );
}
