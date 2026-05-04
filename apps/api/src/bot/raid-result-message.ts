import type { BattlePlayerState, BattleState, Raid } from "../raids/raid.types.js";

export type RaidResultMessage = {
    text: string;
    resultUrl: string;
    buttonText: string;
};

const MAX_LEADERBOARD_PLAYERS = 6;

export function buildRaidResultMessage(input: {
    raid: Raid;
    webAppUrl: string;
}): RaidResultMessage {
    const resultUrl = buildRaidResultUrl({
        webAppUrl: input.webAppUrl,
        raid: input.raid
    });

    const battle = input.raid.battle;

    if (!battle) {
        return {
            text: buildMissingBattleMessage(input.raid),
            resultUrl,
            buttonText: "Open Raid"
        };
    }

    const outcome = getResolvedOutcome(battle);
    const isVictory = outcome === "win";

    const bossHp = Math.max(0, battle.boss.hp);
    const bossMaxHp = Math.max(1, battle.boss.maxHp);
    const players = Object.values(battle.players);
    const leaderboardPlayers = getLeaderboardPlayers(players);

    const totalDamage = players.reduce((damage, player) => {
        return damage + player.damage;
    }, 0);

    const totalPerfectHits = players.reduce((hits, player) => {
        return hits + player.perfectCount;
    }, 0);

    const totalGoodHits = players.reduce((hits, player) => {
        return hits + player.goodCount;
    }, 0);

    const totalMisses = players.reduce((misses, player) => {
        return misses + player.missCount;
    }, 0);

    const totalWrongHits = players.reduce((wrongHits, player) => {
        return wrongHits + player.wrongCount;
    }, 0);

    const bestCombo = players.reduce((combo, player) => {
        return Math.max(combo, player.maxCombo);
    }, 0);

    const survivors = players.filter((player) => player.hp > 0).length;

    const headline = isVictory
        ? `🏆 Raid cleared: ${battle.boss.name}`
        : `💀 Raid failed: ${battle.boss.name} survived`;

    const bossLine = isVictory
        ? `Boss HP: 0/${bossMaxHp}`
        : `Boss HP: ${bossHp}/${bossMaxHp}`;

    const leaderboardLines =
        leaderboardPlayers.length > 0
            ? leaderboardPlayers.map(formatLeaderboardPlayer)
            : ["No player stats recorded."];

    const text = [
        headline,
        "",
        `${formatBossLevel(battle.boss.level)} - ${battle.boss.subtitle}`,
        bossLine,
        `Duration: ${formatDuration(battle)}`,
        `Players: ${players.length}/6`,
        `Survivors: ${survivors}/${players.length}`,
        "",
        "Top damage:",
        ...leaderboardLines,
        "",
        "Squad stats:",
        `Damage: ${formatNumber(totalDamage)}`,
        `Best combo: ${bestCombo}`,
        `Perfect: ${totalPerfectHits}`,
        `Good: ${totalGoodHits}`,
        `Miss/Wrong: ${totalMisses + totalWrongHits}`,
        "",
        isVictory
            ? "Open the result screen or start another raid."
            : "Open the result screen, fix the timing, and run it back."
    ].join("\n");

    return {
        text,
        resultUrl,
        buttonText: isVictory ? "Open Result" : "Retry Raid"
    };
}

function buildMissingBattleMessage(raid: Raid): string {
    return [
        "⚠️ Raid finished, but battle details are unavailable.",
        "",
        `Raid ID: ${raid.id}`,
        `Players: ${Object.keys(raid.players).length}/6`,
        "",
        "Open the raid screen for the latest state."
    ].join("\n");
}

function buildRaidResultUrl(input: {
    webAppUrl: string;
    raid: Raid;
}): string {
    const url = new URL(input.webAppUrl);

    url.searchParams.set("raidId", input.raid.id);
    url.searchParams.set("chatId", input.raid.telegramChatId);

    return url.toString();
}

function getResolvedOutcome(
    battle: BattleState
): Exclude<BattleState["outcome"], null> {
    if (battle.outcome) {
        return battle.outcome;
    }

    return battle.boss.hp <= 0 ? "win" : "lose";
}

function getLeaderboardPlayers(
    players: BattlePlayerState[]
): BattlePlayerState[] {
    return [...players]
        .sort((firstPlayer, secondPlayer) => {
            const damageDiff = secondPlayer.damage - firstPlayer.damage;

            if (damageDiff !== 0) {
                return damageDiff;
            }

            const comboDiff = secondPlayer.maxCombo - firstPlayer.maxCombo;

            if (comboDiff !== 0) {
                return comboDiff;
            }

            return secondPlayer.perfectCount - firstPlayer.perfectCount;
        })
        .slice(0, MAX_LEADERBOARD_PLAYERS);
}

function formatLeaderboardPlayer(
    player: BattlePlayerState,
    index: number
): string {
    return `${index + 1}. ${player.displayName} - ${formatNumber(
        player.damage
    )} dmg, combo ${player.maxCombo}, perfect ${player.perfectCount}`;
}

function formatBossLevel(level: number): string {
    const safeLevel = Number.isFinite(level) ? level : 1;

    return `Level ${String(safeLevel).padStart(2, "0")}`;
}

function formatDuration(battle: BattleState): string {
    const durationMs = Math.max(0, battle.endsAt - battle.startedAt);
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return "0";
    }

    return Math.round(value).toLocaleString("en-US");
}