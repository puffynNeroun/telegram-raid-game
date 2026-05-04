import type {
    BattlePlayerState,
    BattleState,
    BeatdownHitType,
    BeatdownPlayerState,
    BossPhase
} from "./raid.types.js";

export type ApplyBeatdownHitRuleInput = {
    battle: BattleState;
    telegramUserId: string;
    hitType: BeatdownHitType;
    now: number;
};

export type ApplyBeatdownHitRuleResult =
    | {
    ok: true;
    battle: BattleState;
    damageDealt: number;
    combo: number;
    kickCharge: number;
    kickChargeMax: number;
}
    | {
    ok: false;
    reason:
        | "wrong_combat_mode"
        | "beatdown_state_missing"
        | "player_not_in_battle"
        | "player_defeated"
        | "kick_not_charged"
        | "hit_on_cooldown";
};

const PUNCH_DAMAGE = 14;
const PUNCH_KICK_CHARGE_GAIN = 16;
const PUNCH_COOLDOWN_MS = 120;

const KICK_DAMAGE = 90;
const KICK_REQUIRED_CHARGE = 100;
const KICK_COOLDOWN_MS = 650;

export function applyBeatdownHitToBattle(
    input: ApplyBeatdownHitRuleInput
): ApplyBeatdownHitRuleResult {
    if (input.battle.combatMode !== "beatdown") {
        return {
            ok: false,
            reason: "wrong_combat_mode"
        };
    }

    if (!input.battle.beatdown) {
        return {
            ok: false,
            reason: "beatdown_state_missing"
        };
    }

    const battlePlayer = input.battle.players[input.telegramUserId];
    const beatdownPlayer = input.battle.beatdown.players[input.telegramUserId];

    if (!battlePlayer || !beatdownPlayer) {
        return {
            ok: false,
            reason: "player_not_in_battle"
        };
    }

    if (isPlayerDefeated(battlePlayer)) {
        return {
            ok: false,
            reason: "player_defeated"
        };
    }

    if (isHitOnCooldown({ player: beatdownPlayer, hitType: input.hitType, now: input.now })) {
        return {
            ok: false,
            reason: "hit_on_cooldown"
        };
    }

    if (input.hitType === "kick" && beatdownPlayer.kickCharge < KICK_REQUIRED_CHARGE) {
        return {
            ok: false,
            reason: "kick_not_charged"
        };
    }

    const damage = getDamageByHitType(input.hitType);
    const damageResult = applyBossDamage({
        battle: input.battle,
        damage
    });

    const updatedBattlePlayer = updateBattlePlayerAfterBeatdownHit({
        player: battlePlayer,
        hitType: input.hitType,
        hitAt: input.now,
        damageDealt: damageResult.damageDealt
    });

    const updatedBeatdownPlayer = updateBeatdownPlayerAfterHit({
        player: beatdownPlayer,
        hitType: input.hitType,
        hitAt: input.now,
        damageDealt: damageResult.damageDealt
    });

    const battleWithPlayer: BattleState = {
        ...damageResult.battle,
        players: {
            ...damageResult.battle.players,
            [updatedBattlePlayer.telegramUserId]: updatedBattlePlayer
        },
        beatdown: {
            ...input.battle.beatdown,
            players: {
                ...input.battle.beatdown.players,
                [updatedBeatdownPlayer.telegramUserId]: updatedBeatdownPlayer
            }
        }
    };

    return {
        ok: true,
        battle: battleWithPlayer,
        damageDealt: damageResult.damageDealt,
        combo: updatedBattlePlayer.combo,
        kickCharge: updatedBeatdownPlayer.kickCharge,
        kickChargeMax: updatedBeatdownPlayer.kickChargeMax
    };
}

function getDamageByHitType(hitType: BeatdownHitType): number {
    if (hitType === "kick") {
        return KICK_DAMAGE;
    }

    return PUNCH_DAMAGE;
}

function isHitOnCooldown(input: {
    player: BeatdownPlayerState;
    hitType: BeatdownHitType;
    now: number;
}): boolean {
    if (input.hitType === "kick") {
        if (!input.player.lastKickAt) {
            return false;
        }

        return input.now - input.player.lastKickAt < KICK_COOLDOWN_MS;
    }

    if (!input.player.lastHitAt) {
        return false;
    }

    return input.now - input.player.lastHitAt < PUNCH_COOLDOWN_MS;
}

function updateBattlePlayerAfterBeatdownHit(input: {
    player: BattlePlayerState;
    hitType: BeatdownHitType;
    hitAt: number;
    damageDealt: number;
}): BattlePlayerState {
    const nextCombo = input.player.combo + 1;

    return {
        ...input.player,
        combo: nextCombo,
        maxCombo: Math.max(input.player.maxCombo, nextCombo),
        damage: input.player.damage + input.damageDealt,

        isStunned: false,
        stunnedUntil: null,

        lastInputKey: null,
        lastInputAt: input.hitAt,
        lastRating: null,
        lastDamageDealt: input.damageDealt,
        lastDamageTaken: 0
    };
}

function updateBeatdownPlayerAfterHit(input: {
    player: BeatdownPlayerState;
    hitType: BeatdownHitType;
    hitAt: number;
    damageDealt: number;
}): BeatdownPlayerState {
    if (input.hitType === "kick") {
        return {
            ...input.player,
            kickCharge: 0,
            lastHitType: input.hitType,
            lastHitAt: input.hitAt,
            lastHitDamage: input.damageDealt,
            lastKickAt: input.hitAt
        };
    }

    return {
        ...input.player,
        kickCharge: Math.min(
            input.player.kickChargeMax,
            input.player.kickCharge + PUNCH_KICK_CHARGE_GAIN
        ),
        lastHitType: input.hitType,
        lastHitAt: input.hitAt,
        lastHitDamage: input.damageDealt
    };
}

function applyBossDamage(input: {
    battle: BattleState;
    damage: number;
}): { battle: BattleState; damageDealt: number } {
    const damageDealt = Math.min(Math.max(0, input.damage), input.battle.boss.hp);
    const nextBossHp = Math.max(0, input.battle.boss.hp - damageDealt);

    return {
        damageDealt,
        battle: {
            ...input.battle,
            boss: {
                ...input.battle.boss,
                hp: nextBossHp,
                phase: getBossPhaseAfterDamage(nextBossHp, input.battle.boss.maxHp)
            }
        }
    };
}

function getBossPhaseAfterDamage(hp: number, maxHp: number): BossPhase {
    if (hp <= 0) {
        return "defeated";
    }

    const hpRatio = hp / Math.max(1, maxHp);

    if (hpRatio <= 0.33) {
        return "rage";
    }

    if (hpRatio <= 0.66) {
        return "hurt";
    }

    return "idle";
}

function isPlayerDefeated(player: BattlePlayerState): boolean {
    return player.hp <= 0;
}