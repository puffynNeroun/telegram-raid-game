import type { BattlePlayerState, BattleState, Raid } from "../raids/raid.types.js";

export type RaidResultMessage = {
    text: string;
    resultUrl: string;
    buttonText: string;
};

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
            text: "⚠️ Raid finished",
            resultUrl,
            buttonText: "Open Raid"
        };
    }

    const outcome = getResolvedOutcome(battle);
    const isVictory = outcome === "win";
    const players = Object.values(battle.players);
    const mvp = getMvp(players);

    const totalDamage = players.reduce((damage, player) => {
        return damage + player.damage;
    }, 0);

    const totalMissWrong = players.reduce((count, player) => {
        return count + player.missCount + player.wrongCount;
    }, 0);

    const resultLine = isVictory
        ? `🏆 ${battle.boss.name} defeated`
        : `💀 ${battle.boss.name} survived`;

    const mvpLine = mvp
        ? `👑 ${mvp.displayName}: ${formatNumber(mvp.damage)} dmg · x${mvp.maxCombo}`
        : "👑 MVP: none";

    const teamLine = `⚔️ Team: ${formatNumber(totalDamage)} dmg · Miss ${totalMissWrong}`;

    return {
        text: [resultLine, mvpLine, teamLine].join("\n"),
        resultUrl,
        buttonText: isVictory ? "Open Result" : "Retry Raid"
    };
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

function getMvp(players: BattlePlayerState[]): BattlePlayerState | null {
    return (
        [...players].sort((firstPlayer, secondPlayer) => {
            const damageDiff = secondPlayer.damage - firstPlayer.damage;

            if (damageDiff !== 0) {
                return damageDiff;
            }

            return secondPlayer.maxCombo - firstPlayer.maxCombo;
        })[0] ?? null
    );
}

function formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return "0";
    }

    return Math.round(value).toLocaleString("en-US");
}