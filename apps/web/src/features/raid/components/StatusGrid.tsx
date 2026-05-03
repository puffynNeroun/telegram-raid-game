type StatusGridProps = {
    raidStatus: string;
    playerCount: number;
    timeLabel: string;
    timeValue: string | null;
};

export function StatusGrid({ raidStatus, playerCount, timeLabel, timeValue }: StatusGridProps) {
    return (
        <section className="status-grid">
            <div className="status-box">
                <span>Status</span>
                <strong>{raidStatus}</strong>
            </div>

            <div className="status-box">
                <span>Players</span>
                <strong>{playerCount}/6</strong>
            </div>

            <div className="status-box">
                <span>{timeLabel}</span>
                <strong>{timeValue}</strong>
            </div>
        </section>
    );
}
