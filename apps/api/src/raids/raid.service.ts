import { nanoid } from "nanoid";
import { DEFAULT_BOSS_ID, getBossConfig, isBossId } from "./boss.config.js";
import type {
    BattleAttackInput,
    BattleAttackResult,
    BeatdownHitInput,
    BeatdownHitResult,
    BeatdownHitType,
    BeatdownState,
    BattleInputActionInput,
    BattleInputActionResult,
    BattleInputKey,
    BattleInputRating,
    BattleNote,
    BattlePlayerState,
    BattleState,
    BossConfig,
    BossPhase,
    BossHpMultiplierByPlayers,
    CreateRaidInput,
    CreateRaidResult,
    FinalizeExpiredBattleResult,
    JoinRaidInput,
    JoinRaidResult,
    Raid,
    RaidPlayer,
    ResolveMissedNotesInput,
    ResolveMissedNotesResult,
    SetReadyInput,
    SetReadyResult,
    SelectRaidBossInput,
    SelectRaidBossResult,
    StartRaidInput,
    StartRaidResult
} from "./raid.types.js";
import {
    BATTLE_INPUT_KEYS,
    BATTLE_RESULT_TTL_SECONDS,
    BEATDOWN_HIT_TYPES,
    MAX_PLAYERS_PER_RAID,
    RAID_TTL_SECONDS
} from "./raid.types.js";
import type { RaidRepository } from "./raid.repository.js";
import {
    applyBeatdownHitToBattle,
    BEATDOWN_KICK_CHARGE_MAX,
    BEATDOWN_STAMINA_MAX,
    BEATDOWN_STAMINA_REGEN_PER_SECOND
} from "./beatdown.rules.js";

type ApplyBattleDamageResult =
    | {
    ok: true;
    raid: Raid;
    damageDealt: number;
}
    | {
    ok: false;
    reason:
        | "raid_not_found"
        | "no_active_battle"
        | "battle_expired"
        | "player_not_in_battle"
        | "player_defeated";
};

type BattleInputCandidate = {
    note: BattleNote;
    noteIndex: number;
    distanceMs: number;
};

type RandomGenerator = () => number;
const DEFAULT_COMBAT_MODE = "rhythm" as const;

export class RaidService {
    constructor(private readonly raidRepository: RaidRepository) {}

    async createRaid(input: CreateRaidInput): Promise<CreateRaidResult> {
        const now = Date.now();
        const bossConfig = getBossConfig(input.bossId ?? DEFAULT_BOSS_ID);
        const combatMode = input.combatMode ?? DEFAULT_COMBAT_MODE;

        const raid: Raid = {
            id: nanoid(10),
            bossId: bossConfig.id,
            combatMode,

            telegramChatId: input.telegramChatId,
            hostTelegramUserId: input.hostTelegramUserId,
            hostDisplayName: input.hostDisplayName,

            status: "lobby",
            createdAt: now,
            expiresAt: now + RAID_TTL_SECONDS * 1000,

            battle: null,
            players: {
                [input.hostTelegramUserId]: {
                    telegramUserId: input.hostTelegramUserId,
                    displayName: input.hostDisplayName,
                    isHost: true,
                    isReady: false,
                    joinedAt: now
                }
            }
        };

        const created = await this.raidRepository.createRaid(raid);

        if (!created) {
            const activeRaid = await this.raidRepository.getActiveRaidByChat(
                input.telegramChatId
            );

            return {
                ok: false,
                reason: "active_raid_exists",
                activeRaid
            };
        }

        return {
            ok: true,
            raid
        };
    }

    async getRaid(raidId: string): Promise<Raid | null> {
        return this.raidRepository.getRaid(raidId);
    }

    async markRaidResultNotificationPending(raidId: string): Promise<boolean> {
        return this.raidRepository.markRaidResultNotificationPending(raidId);
    }

    async joinRaid(input: JoinRaidInput): Promise<JoinRaidResult> {
        const raid = await this.raidRepository.getRaid(input.raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        const lobbyValidationError = this.validateLobbyRaid(raid);

        if (lobbyValidationError) {
            return {
                ok: false,
                reason: lobbyValidationError
            };
        }

        const existingPlayer = raid.players[input.telegramUserId];

        if (existingPlayer) {
            return {
                ok: true,
                raid,
                player: existingPlayer
            };
        }

        const playerCount = Object.keys(raid.players).length;

        if (playerCount >= MAX_PLAYERS_PER_RAID) {
            return {
                ok: false,
                reason: "raid_full"
            };
        }

        const player: RaidPlayer = {
            telegramUserId: input.telegramUserId,
            displayName: input.displayName,
            isHost: false,
            isReady: false,
            joinedAt: Date.now()
        };

        const updatedRaid: Raid = {
            ...raid,
            bossId: raid.bossId ?? DEFAULT_BOSS_ID,
            combatMode: raid.combatMode ?? DEFAULT_COMBAT_MODE,
            players: {
                ...raid.players,
                [input.telegramUserId]: player
            }
        };

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid,
            player
        };
    }

    async setReady(input: SetReadyInput): Promise<SetReadyResult> {
        const raid = await this.raidRepository.getRaid(input.raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        const lobbyValidationError = this.validateLobbyRaid(raid);

        if (lobbyValidationError) {
            return {
                ok: false,
                reason: lobbyValidationError
            };
        }

        const player = raid.players[input.telegramUserId];

        if (!player) {
            return {
                ok: false,
                reason: "player_not_in_raid"
            };
        }

        const updatedPlayer: RaidPlayer = {
            ...player,
            isReady: input.isReady
        };

        const updatedRaid: Raid = {
            ...raid,
            bossId: raid.bossId ?? DEFAULT_BOSS_ID,
            combatMode: raid.combatMode ?? DEFAULT_COMBAT_MODE,
            players: {
                ...raid.players,
                [input.telegramUserId]: updatedPlayer
            }
        };

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid,
            player: updatedPlayer
        };
    }


    async selectRaidBoss(
        input: SelectRaidBossInput
    ): Promise<SelectRaidBossResult> {
        const raid = await this.raidRepository.getRaid(input.raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        const lobbyValidationError = this.validateLobbyRaid(raid);

        if (lobbyValidationError) {
            return {
                ok: false,
                reason: lobbyValidationError
            };
        }

        const player = raid.players[input.telegramUserId];

        if (!player) {
            return {
                ok: false,
                reason: "player_not_in_raid"
            };
        }

        if (!player.isHost) {
            return {
                ok: false,
                reason: "only_host_can_select_boss"
            };
        }

        if (!isBossId(input.bossId)) {
            return {
                ok: false,
                reason: "invalid_boss_id"
            };
        }

        const bossConfig = getBossConfig(input.bossId);
        const updatedRaid: Raid = {
            ...raid,
            bossId: bossConfig.id,
            combatMode: raid.combatMode ?? DEFAULT_COMBAT_MODE,
            players: resetReadyState(raid.players)
        };

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid
        };
    }

    async startRaid(input: StartRaidInput): Promise<StartRaidResult> {
        const raid = await this.raidRepository.getRaid(input.raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        const lobbyValidationError = this.validateLobbyRaid(raid);

        if (lobbyValidationError) {
            return {
                ok: false,
                reason: lobbyValidationError
            };
        }

        const player = raid.players[input.telegramUserId];

        if (!player) {
            return {
                ok: false,
                reason: "player_not_in_raid"
            };
        }

        if (!player.isHost) {
            return {
                ok: false,
                reason: "only_host_can_start"
            };
        }

        const hasReadyPlayer = Object.values(raid.players).some(
            (raidPlayer) => raidPlayer.isReady
        );

        if (!hasReadyPlayer) {
            return {
                ok: false,
                reason: "no_ready_players"
            };
        }

        const now = Date.now();
        const bossConfig = resolveRaidBossConfig(raid);
        const battle = this.createBattleState({
            raid,
            bossConfig,
            startedAt: now
        });

        const updatedRaid: Raid = {
            ...raid,
            bossId: bossConfig.id,
            combatMode: raid.combatMode ?? DEFAULT_COMBAT_MODE,
            status: "battle",
            battle,
            expiresAt:
                now +
                (bossConfig.durationSeconds + BATTLE_RESULT_TTL_SECONDS) * 1000
        };

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid
        };
    }

    async applyBattleAttack(input: BattleAttackInput): Promise<BattleAttackResult> {
        const raid = await this.raidRepository.getRaid(input.raidId);
        const bossConfig = raid?.battle
            ? resolveBattleBossConfig(raid.battle)
            : getBossConfig(DEFAULT_BOSS_ID);

        const result = await this.applyBattleDamage({
            raidId: input.raidId,
            telegramUserId: input.telegramUserId,
            damage: bossConfig.scoring.attackDamage
        });

        if (!result.ok) {
            return result;
        }

        return {
            ok: true,
            raid: result.raid,
            damageDealt: result.damageDealt
        };
    }

    async applyBattleInput(
        input: BattleInputActionInput
    ): Promise<BattleInputActionResult> {
        if (!isBattleInputKey(input.key)) {
            return {
                ok: false,
                reason: "invalid_input_key"
            };
        }

        const raid = await this.raidRepository.getRaid(input.raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        if (!this.isActiveBattleRaid(raid)) {
            return {
                ok: false,
                reason: "no_active_battle"
            };
        }

        const now = Date.now();

        if (now >= raid.battle.endsAt) {
            return {
                ok: false,
                reason: "battle_expired"
            };
        }

        const bossConfig = resolveBattleBossConfig(raid.battle);

        const missedResult = resolveMissedNotesInBattle({
            battle: raid.battle,
            bossConfig,
            now
        });

        const raidAfterMisses = buildRaidAfterBattleChange({
            raid: {
                ...raid,
                battle: missedResult.battle
            },
            battle: missedResult.battle,
            finishedAt: now
        });

        if (raidAfterMisses.status === "finished") {
            await this.raidRepository.saveRaid(raidAfterMisses);

            return {
                ok: false,
                reason: "player_defeated"
            };
        }

        const battle = raidAfterMisses.battle;

        if (!battle || battle.status !== "active") {
            return {
                ok: false,
                reason: "no_active_battle"
            };
        }

        const battlePlayer = battle.players[input.telegramUserId];

        if (!battlePlayer) {
            if (missedResult.resolvedCount > 0) {
                await this.raidRepository.saveRaid(raidAfterMisses);
            }

            return {
                ok: false,
                reason: "player_not_in_battle"
            };
        }

        if (isPlayerDefeated(battlePlayer)) {
            if (missedResult.resolvedCount > 0) {
                await this.raidRepository.saveRaid(raidAfterMisses);
            }

            return {
                ok: false,
                reason: "player_defeated"
            };
        }

        const inputResult = applyBattleInputToBattle({
            battle,
            bossConfig,
            telegramUserId: input.telegramUserId,
            key: input.key,
            inputAt: now
        });

        const updatedRaid = buildRaidAfterBattleChange({
            raid: raidAfterMisses,
            battle: inputResult.battle,
            finishedAt: now
        });

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid,
            key: input.key,
            noteId: inputResult.noteId,
            rating: inputResult.rating,
            damageDealt: inputResult.damageDealt,
            damageTaken: inputResult.damageTaken,
            combo: inputResult.combo
        };
    }

    async applyBeatdownHit(input: BeatdownHitInput): Promise<BeatdownHitResult> {
        if (!isBeatdownHitType(input.hitType)) {
            return {
                ok: false,
                reason: "invalid_beatdown_hit_type"
            };
        }

        const raid = await this.raidRepository.getRaid(input.raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        if (!this.isActiveBattleRaid(raid)) {
            return {
                ok: false,
                reason: "no_active_battle"
            };
        }

        const now = Date.now();

        if (now >= raid.battle.endsAt) {
            return {
                ok: false,
                reason: "battle_expired"
            };
        }

        const hitResult = applyBeatdownHitToBattle({
            battle: raid.battle,
            telegramUserId: input.telegramUserId,
            hitType: input.hitType,
            now
        });

        if (!hitResult.ok) {
            return {
                ok: false,
                reason: hitResult.reason
            };
        }

        const updatedRaid = buildRaidAfterBattleChange({
            raid,
            battle: hitResult.battle,
            finishedAt: now
        });

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid,
            hitType: input.hitType,
            damageDealt: hitResult.damageDealt,
            combo: hitResult.combo,
            kickCharge: hitResult.kickCharge,
            kickChargeMax: hitResult.kickChargeMax,
            stamina: hitResult.stamina,
            staminaMax: hitResult.staminaMax
        };
    }

    async resolveMissedNotes(
        input: ResolveMissedNotesInput
    ): Promise<ResolveMissedNotesResult> {
        const raid = await this.raidRepository.getRaid(input.raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        if (!this.isActiveBattleRaid(raid)) {
            return {
                ok: false,
                reason: "no_active_battle"
            };
        }

        const now = Date.now();
        const bossConfig = resolveBattleBossConfig(raid.battle);

        const result = resolveMissedNotesInBattle({
            battle: raid.battle,
            bossConfig,
            now
        });

        if (result.resolvedCount <= 0) {
            return {
                ok: true,
                raid,
                resolvedCount: 0
            };
        }

        const updatedRaid = buildRaidAfterBattleChange({
            raid,
            battle: result.battle,
            finishedAt: now
        });

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid,
            resolvedCount: result.resolvedCount
        };
    }

    async finalizeExpiredBattle(
        raidId: string
    ): Promise<FinalizeExpiredBattleResult> {
        const raid = await this.raidRepository.getRaid(raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        if (raid.status !== "battle" || !raid.battle) {
            return {
                ok: false,
                reason: "no_active_battle"
            };
        }

        if (raid.battle.status !== "active") {
            return {
                ok: false,
                reason: "no_active_battle"
            };
        }

        const now = Date.now();

        if (now < raid.battle.endsAt) {
            return {
                ok: false,
                reason: "battle_not_expired"
            };
        }

        const bossConfig = resolveBattleBossConfig(raid.battle);

        const battleWithFinalMisses = resolveAllPendingNotesAsMissed({
            battle: raid.battle,
            bossConfig,
            now
        });

        const updatedRaid = finishBattleRaid({
            raid,
            battle: battleWithFinalMisses,
            finishedAt: now,
            outcome: battleWithFinalMisses.boss.hp <= 0 ? "win" : "lose"
        });

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid,
            finalized: true
        };
    }

    private async applyBattleDamage(input: {
        raidId: string;
        telegramUserId: string;
        damage: number;
    }): Promise<ApplyBattleDamageResult> {
        const raid = await this.raidRepository.getRaid(input.raidId);

        if (!raid) {
            return {
                ok: false,
                reason: "raid_not_found"
            };
        }

        if (!this.isActiveBattleRaid(raid)) {
            return {
                ok: false,
                reason: "no_active_battle"
            };
        }

        const now = Date.now();

        if (now >= raid.battle.endsAt) {
            return {
                ok: false,
                reason: "battle_expired"
            };
        }

        const battlePlayer = raid.battle.players[input.telegramUserId];

        if (!battlePlayer) {
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

        const damageResult = applyBossDamageToBattle({
            battle: raid.battle,
            damage: input.damage
        });

        const updatedBattlePlayer: BattlePlayerState = {
            ...battlePlayer,
            damage: battlePlayer.damage + damageResult.damageDealt,
            lastInputKey: null,
            lastInputAt: now,
            lastRating: null,
            lastDamageDealt: damageResult.damageDealt,
            lastDamageTaken: 0
        };

        const battleWithPlayer = updateBattlePlayer(
            damageResult.battle,
            updatedBattlePlayer
        );

        const updatedRaid = buildRaidAfterBattleChange({
            raid,
            battle: battleWithPlayer,
            finishedAt: now
        });

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid,
            damageDealt: damageResult.damageDealt
        };
    }

    private validateLobbyRaid(
        raid: Raid
    ): "raid_expired" | "raid_not_joinable" | null {
        if (Date.now() >= raid.expiresAt) {
            return "raid_expired";
        }

        if (raid.status !== "lobby") {
            return "raid_not_joinable";
        }

        return null;
    }

    private createBattleState(input: {
        raid: Raid;
        bossConfig: BossConfig;
        startedAt: number;
    }): BattleState {
        const players = Object.values(input.raid.players);
        const playerCount = players.length;
        const bossMaxHp = calculateBossHp({
            playerCount,
            bossConfig: input.bossConfig
        });

        const endsAt = input.startedAt + input.bossConfig.durationSeconds * 1000;
        const introEndsAt = input.startedAt + input.bossConfig.note.introCountdownMs;
        const noteSeed = createBattleNoteSeed({
            raidId: input.raid.id,
            bossId: input.bossConfig.id,
            startedAt: input.startedAt
        });

        const combatMode = input.raid.combatMode ?? DEFAULT_COMBAT_MODE;

        return {
            status: "active",
            outcome: null,
            combatMode,

            bossId: input.bossConfig.id,
            noteSeed,

            startedAt: input.startedAt,
            introEndsAt,
            endsAt,
            durationSeconds: input.bossConfig.durationSeconds,

            boss: {
                id: input.bossConfig.id,
                level: input.bossConfig.level,
                name: input.bossConfig.name,
                subtitle: input.bossConfig.subtitle,
                assetSlug: input.bossConfig.assetSlug,

                hp: bossMaxHp,
                maxHp: bossMaxHp,
                phase: "idle"
            },

            players: createBattlePlayers({
                players,
                bossConfig: input.bossConfig
            }),


            notesByPlayer:
                combatMode === "rhythm"
                    ? createBattleNotesByPlayer({
                        players,
                        bossConfig: input.bossConfig,
                        startedAt: input.startedAt,
                        endsAt,
                        noteSeed
                    })
                    : {},

            beatdown:
                combatMode === "beatdown"
                    ? createBeatdownState({
                        players,
                        now: input.startedAt
                    })
                    : null
        };
    }

    private isActiveBattleRaid(
        raid: Raid
    ): raid is Raid & { battle: NonNullable<Raid["battle"]> } {
        return (
            raid.status === "battle" &&
            Boolean(raid.battle) &&
            raid.battle?.status === "active"
        );
    }
}


function resetReadyState(
    players: Record<string, RaidPlayer>
): Record<string, RaidPlayer> {
    return Object.fromEntries(
        Object.entries(players).map(([telegramUserId, player]) => [
            telegramUserId,
            {
                ...player,
                isReady: false
            } satisfies RaidPlayer
        ])
    );
}

function createBattlePlayers(input: {
    players: RaidPlayer[];
    bossConfig: BossConfig;
}): Record<string, BattlePlayerState> {
    return Object.fromEntries(
        input.players.map((player) => [
            player.telegramUserId,
            {
                telegramUserId: player.telegramUserId,
                displayName: player.displayName,

                hp: input.bossConfig.playerMaxHp,
                maxHp: input.bossConfig.playerMaxHp,

                combo: 0,
                maxCombo: 0,

                damage: 0,
                perfectCount: 0,
                goodCount: 0,
                missCount: 0,
                wrongCount: 0,

                deaths: 0,
                isStunned: false,
                stunnedUntil: null,

                lastInputKey: null,
                lastInputAt: null,
                lastRating: null,
                lastDamageDealt: 0,
                lastDamageTaken: 0
            } satisfies BattlePlayerState
        ])
    );
}

function createBeatdownState(input: {
    players: RaidPlayer[];
    now: number;
}): BeatdownState {
    return {
        players: Object.fromEntries(
            input.players.map((player) => [
                player.telegramUserId,
                {
                    telegramUserId: player.telegramUserId,
                    displayName: player.displayName,

                    stamina: BEATDOWN_STAMINA_MAX,
                    staminaMax: BEATDOWN_STAMINA_MAX,
                    staminaRegenPerSecond: BEATDOWN_STAMINA_REGEN_PER_SECOND,
                    lastStaminaUpdatedAt: input.now,

                    kickCharge: 0,
                    kickChargeMax: BEATDOWN_KICK_CHARGE_MAX,

                    lastHitType: null,
                    lastHitAt: null,
                    lastHitDamage: 0,

                    lastKickAt: null
                }
            ])
        )
    };
}

function createBattleNotesByPlayer(input: {
    players: RaidPlayer[];
    bossConfig: BossConfig;
    startedAt: number;
    endsAt: number;
    noteSeed: string;
}): Record<string, BattleNote[]> {
    return Object.fromEntries(
        input.players.map((player, playerIndex) => [
            player.telegramUserId,
            createBattleNotesForPlayer({
                telegramUserId: player.telegramUserId,
                playerIndex,
                bossConfig: input.bossConfig,
                startedAt: input.startedAt,
                endsAt: input.endsAt,
                noteSeed: input.noteSeed
            })
        ])
    );
}

function createBattleNotesForPlayer(input: {
    telegramUserId: string;
    playerIndex: number;
    bossConfig: BossConfig;
    startedAt: number;
    endsAt: number;
    noteSeed: string;
}): BattleNote[] {
    const notes: BattleNote[] = [];
    const firstHitAt =
        input.startedAt +
        input.bossConfig.note.introCountdownMs +
        input.bossConfig.note.firstHitDelayMs;
    const lastHitAt = input.endsAt - input.bossConfig.note.missWindowMs;

    const random = createSeededRandom(
        `${input.noteSeed}:${input.telegramUserId}:${input.playerIndex}`
    );

    let previousKey: BattleInputKey | null = null;
    let repeatCount = 0;

    for (
        let hitAt = firstHitAt, noteIndex = 0;
        hitAt <= lastHitAt;
        hitAt += input.bossConfig.note.intervalMs, noteIndex += 1
    ) {
        const key = pickBattleInputKey({
            random,
            previousKey,
            repeatCount
        });

        if (key === previousKey) {
            repeatCount += 1;
        } else {
            previousKey = key;
            repeatCount = 1;
        }

        notes.push({
            id: nanoid(10),
            telegramUserId: input.telegramUserId,
            key,
            hitAt,
            status: "pending",
            rating: null,
            resolvedAt: null,
            inputAt: null
        });
    }

    return notes;
}

function applyBattleInputToBattle(input: {
    battle: BattleState;
    bossConfig: BossConfig;
    telegramUserId: string;
    key: BattleInputKey;
    inputAt: number;
}): {
    battle: BattleState;
    noteId: string | null;
    rating: BattleInputRating;
    damageDealt: number;
    damageTaken: number;
    combo: number;
} {
    const notes = input.battle.notesByPlayer[input.telegramUserId] ?? [];
    const candidate = findClosestPendingNote({
        notes,
        inputAt: input.inputAt,
        missWindowMs: input.bossConfig.note.missWindowMs
    });

    if (!candidate) {
        const player = input.battle.players[input.telegramUserId];
        const updatedPlayer = applyFailedInputToPlayer({
            player,
            key: input.key,
            inputAt: input.inputAt,
            rating: "wrong",
            damageTaken: input.bossConfig.scoring.wrongPlayerDamage
        });

        return {
            battle: updateBattlePlayer(input.battle, updatedPlayer),
            noteId: null,
            rating: "wrong",
            damageDealt: input.bossConfig.scoring.wrongDamage,
            damageTaken: input.bossConfig.scoring.wrongPlayerDamage,
            combo: updatedPlayer.combo
        };
    }

    if (candidate.note.key !== input.key) {
        const player = input.battle.players[input.telegramUserId];
        const updatedPlayer = applyFailedInputToPlayer({
            player,
            key: input.key,
            inputAt: input.inputAt,
            rating: "wrong",
            damageTaken: input.bossConfig.scoring.wrongPlayerDamage
        });

        return {
            battle: updateBattlePlayer(input.battle, updatedPlayer),
            noteId: candidate.note.id,
            rating: "wrong",
            damageDealt: input.bossConfig.scoring.wrongDamage,
            damageTaken: input.bossConfig.scoring.wrongPlayerDamage,
            combo: updatedPlayer.combo
        };
    }

    const rating = getRatingFromTiming({
        distanceMs: candidate.distanceMs,
        bossConfig: input.bossConfig
    });

    if (rating === "miss") {
        const player = input.battle.players[input.telegramUserId];
        const updatedPlayer = applyFailedInputToPlayer({
            player,
            key: input.key,
            inputAt: input.inputAt,
            rating: "miss",
            damageTaken: input.bossConfig.scoring.missPlayerDamage
        });

        const battleWithMissedNote = updateBattleNote({
            battle: input.battle,
            telegramUserId: input.telegramUserId,
            noteIndex: candidate.noteIndex,
            note: {
                ...candidate.note,
                status: "missed",
                rating: "miss",
                resolvedAt: input.inputAt,
                inputAt: input.inputAt
            }
        });

        return {
            battle: updateBattlePlayer(battleWithMissedNote, updatedPlayer),
            noteId: candidate.note.id,
            rating: "miss",
            damageDealt: input.bossConfig.scoring.missDamage,
            damageTaken: input.bossConfig.scoring.missPlayerDamage,
            combo: updatedPlayer.combo
        };
    }

    const player = input.battle.players[input.telegramUserId];
    const nextCombo = player.combo + 1;
    const damage = getDamageForRating({
        rating,
        combo: nextCombo,
        bossConfig: input.bossConfig
    });

    const bossDamageResult = applyBossDamageToBattle({
        battle: input.battle,
        damage
    });

    const updatedPlayer = applySuccessfulInputToPlayer({
        player,
        key: input.key,
        inputAt: input.inputAt,
        rating,
        damageDealt: bossDamageResult.damageDealt
    });

    const battleWithHitNote = updateBattleNote({
        battle: bossDamageResult.battle,
        telegramUserId: input.telegramUserId,
        noteIndex: candidate.noteIndex,
        note: {
            ...candidate.note,
            status: "hit",
            rating,
            resolvedAt: input.inputAt,
            inputAt: input.inputAt
        }
    });

    return {
        battle: updateBattlePlayer(battleWithHitNote, updatedPlayer),
        noteId: candidate.note.id,
        rating,
        damageDealt: bossDamageResult.damageDealt,
        damageTaken: 0,
        combo: updatedPlayer.combo
    };
}

function resolveMissedNotesInBattle(input: {
    battle: BattleState;
    bossConfig: BossConfig;
    now: number;
}): { battle: BattleState; resolvedCount: number } {
    let resolvedCount = 0;
    let nextBattle = input.battle;

    for (const [telegramUserId, notes] of Object.entries(
        input.battle.notesByPlayer
    )) {
        const player = nextBattle.players[telegramUserId];

        if (!player) {
            continue;
        }

        let nextPlayer = player;
        let didChangeNotes = false;

        const nextNotes: BattleNote[] = notes.map((note): BattleNote => {
            if (note.status !== "pending") {
                return note;
            }

            if (input.now <= note.hitAt + input.bossConfig.note.missWindowMs) {
                return note;
            }

            resolvedCount += 1;
            didChangeNotes = true;

            if (!isPlayerDefeated(nextPlayer)) {
                nextPlayer = applyFailedInputToPlayer({
                    player: nextPlayer,
                    key: null,
                    inputAt: null,
                    rating: "miss",
                    damageTaken: input.bossConfig.scoring.missPlayerDamage
                });
            }

            return {
                ...note,
                status: "missed",
                rating: "miss",
                resolvedAt: input.now,
                inputAt: null
            };
        });

        if (didChangeNotes) {
            nextBattle = {
                ...nextBattle,
                players: {
                    ...nextBattle.players,
                    [telegramUserId]: nextPlayer
                },
                notesByPlayer: {
                    ...nextBattle.notesByPlayer,
                    [telegramUserId]: nextNotes
                }
            };
        }
    }

    return {
        battle: nextBattle,
        resolvedCount
    };
}

function resolveAllPendingNotesAsMissed(input: {
    battle: BattleState;
    bossConfig: BossConfig;
    now: number;
}): BattleState {
    let nextBattle = input.battle;

    for (const [telegramUserId, notes] of Object.entries(
        input.battle.notesByPlayer
    )) {
        const player = nextBattle.players[telegramUserId];

        if (!player) {
            continue;
        }

        let nextPlayer = player;
        let didChangeNotes = false;

        const nextNotes: BattleNote[] = notes.map((note): BattleNote => {
            if (note.status !== "pending") {
                return note;
            }

            didChangeNotes = true;

            if (!isPlayerDefeated(nextPlayer)) {
                nextPlayer = applyFailedInputToPlayer({
                    player: nextPlayer,
                    key: null,
                    inputAt: null,
                    rating: "miss",
                    damageTaken: input.bossConfig.scoring.missPlayerDamage
                });
            }

            return {
                ...note,
                status: "missed",
                rating: "miss",
                resolvedAt: input.now,
                inputAt: null
            };
        });

        if (didChangeNotes) {
            nextBattle = {
                ...nextBattle,
                players: {
                    ...nextBattle.players,
                    [telegramUserId]: nextPlayer
                },
                notesByPlayer: {
                    ...nextBattle.notesByPlayer,
                    [telegramUserId]: nextNotes
                }
            };
        }
    }

    return nextBattle;
}

function findClosestPendingNote(input: {
    notes: BattleNote[];
    inputAt: number;
    missWindowMs: number;
}): BattleInputCandidate | null {
    let bestCandidate: BattleInputCandidate | null = null;

    input.notes.forEach((note, noteIndex) => {
        if (note.status !== "pending") {
            return;
        }

        const distanceMs = Math.abs(note.hitAt - input.inputAt);

        if (distanceMs > input.missWindowMs) {
            return;
        }

        if (!bestCandidate || distanceMs < bestCandidate.distanceMs) {
            bestCandidate = {
                note,
                noteIndex,
                distanceMs
            };
        }
    });

    return bestCandidate;
}

function getRatingFromTiming(input: {
    distanceMs: number;
    bossConfig: BossConfig;
}): Exclude<BattleInputRating, "wrong"> {
    if (input.distanceMs <= input.bossConfig.note.perfectWindowMs) {
        return "perfect";
    }

    if (input.distanceMs <= input.bossConfig.note.goodWindowMs) {
        return "good";
    }

    return "miss";
}

function getDamageForRating(input: {
    rating: Exclude<BattleInputRating, "miss" | "wrong">;
    combo: number;
    bossConfig: BossConfig;
}): number {
    const baseDamage =
        input.rating === "perfect"
            ? input.bossConfig.scoring.perfectDamage
            : input.bossConfig.scoring.goodDamage;

    return (
        baseDamage +
        getComboBonusDamage({
            combo: input.combo,
            bossConfig: input.bossConfig
        })
    );
}

function getComboBonusDamage(input: {
    combo: number;
    bossConfig: BossConfig;
}): number {
    const scoring = input.bossConfig.scoring;

    if (scoring.comboBonusEvery <= 0 || scoring.comboBonusStep <= 0) {
        return 0;
    }

    return Math.min(
        scoring.comboBonusCap,
        Math.floor(input.combo / scoring.comboBonusEvery) * scoring.comboBonusStep
    );
}

function applySuccessfulInputToPlayer(input: {
    player: BattlePlayerState;
    key: BattleInputKey;
    inputAt: number;
    rating: Exclude<BattleInputRating, "miss" | "wrong">;
    damageDealt: number;
}): BattlePlayerState {
    const nextCombo = input.player.combo + 1;

    return {
        ...input.player,
        combo: nextCombo,
        maxCombo: Math.max(input.player.maxCombo, nextCombo),
        damage: input.player.damage + input.damageDealt,
        perfectCount:
            input.rating === "perfect"
                ? input.player.perfectCount + 1
                : input.player.perfectCount,
        goodCount:
            input.rating === "good"
                ? input.player.goodCount + 1
                : input.player.goodCount,
        isStunned: false,
        stunnedUntil: null,
        lastInputKey: input.key,
        lastInputAt: input.inputAt,
        lastRating: input.rating,
        lastDamageDealt: input.damageDealt,
        lastDamageTaken: 0
    };
}

function applyFailedInputToPlayer(input: {
    player: BattlePlayerState;
    key: BattleInputKey | null;
    inputAt: number | null;
    rating: Extract<BattleInputRating, "miss" | "wrong">;
    damageTaken: number;
}): BattlePlayerState {
    if (isPlayerDefeated(input.player)) {
        return {
            ...input.player,
            lastInputKey: input.key,
            lastInputAt: input.inputAt,
            lastRating: input.rating,
            lastDamageDealt: 0,
            lastDamageTaken: 0
        };
    }

    const damagedPlayer = applyPlayerDamage({
        player: input.player,
        damageTaken: input.damageTaken
    });

    return {
        ...damagedPlayer,
        combo: 0,
        missCount:
            input.rating === "miss"
                ? damagedPlayer.missCount + 1
                : damagedPlayer.missCount,
        wrongCount:
            input.rating === "wrong"
                ? damagedPlayer.wrongCount + 1
                : damagedPlayer.wrongCount,
        lastInputKey: input.key,
        lastInputAt: input.inputAt,
        lastRating: input.rating,
        lastDamageDealt: 0,
        lastDamageTaken: input.damageTaken
    };
}

function applyPlayerDamage(input: {
    player: BattlePlayerState;
    damageTaken: number;
}): BattlePlayerState {
    if (input.damageTaken <= 0 || isPlayerDefeated(input.player)) {
        return input.player;
    }

    const nextHp = Math.max(0, input.player.hp - input.damageTaken);

    if (nextHp > 0) {
        return {
            ...input.player,
            hp: nextHp
        };
    }

    return {
        ...input.player,
        hp: 0,
        combo: 0,
        deaths: input.player.deaths + 1,
        isStunned: false,
        stunnedUntil: null
    };
}

function applyBossDamageToBattle(input: {
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

function updateBattlePlayer(
    battle: BattleState,
    player: BattlePlayerState
): BattleState {
    return {
        ...battle,
        players: {
            ...battle.players,
            [player.telegramUserId]: player
        }
    };
}

function updateBattleNote(input: {
    battle: BattleState;
    telegramUserId: string;
    noteIndex: number;
    note: BattleNote;
}): BattleState {
    const notes = input.battle.notesByPlayer[input.telegramUserId] ?? [];
    const nextNotes = [...notes];

    nextNotes[input.noteIndex] = input.note;

    return {
        ...input.battle,
        notesByPlayer: {
            ...input.battle.notesByPlayer,
            [input.telegramUserId]: nextNotes
        }
    };
}

function buildRaidAfterBattleChange(input: {
    raid: Raid;
    battle: BattleState;
    finishedAt: number;
}): Raid {
    if (input.battle.boss.hp <= 0) {
        return finishBattleRaid({
            raid: input.raid,
            battle: input.battle,
            finishedAt: input.finishedAt,
            outcome: "win"
        });
    }

    if (areAllPlayersDefeated(input.battle)) {
        return finishBattleRaid({
            raid: input.raid,
            battle: input.battle,
            finishedAt: input.finishedAt,
            outcome: "lose"
        });
    }

    return {
        ...input.raid,
        bossId: input.battle.bossId,
        combatMode: input.battle.combatMode,
        status: "battle",
        battle: {
            ...input.battle,
            status: "active",
            outcome: null,
            boss: {
                ...input.battle.boss,
                phase: getBossPhaseAfterDamage(
                    input.battle.boss.hp,
                    input.battle.boss.maxHp
                )
            }
        }
    };
}

function finishBattleRaid(input: {
    raid: Raid;
    battle: BattleState;
    finishedAt: number;
    outcome: Exclude<BattleState["outcome"], null>;
}): Raid {
    return {
        ...input.raid,
        bossId: input.battle.bossId,
        combatMode: input.battle.combatMode,
        status: "finished",
        expiresAt: input.finishedAt + BATTLE_RESULT_TTL_SECONDS * 1000,
        battle: {
            ...input.battle,
            status: "finished",
            outcome: input.outcome,
            endsAt: input.finishedAt,
            boss: {
                ...input.battle.boss,
                phase:
                    input.outcome === "win"
                        ? "defeated"
                        : getBossPhaseAfterDamage(
                            input.battle.boss.hp,
                            input.battle.boss.maxHp
                        )
            }
        }
    };
}

function areAllPlayersDefeated(battle: BattleState): boolean {
    const players = Object.values(battle.players);

    return players.length > 0 && players.every(isPlayerDefeated);
}

function isPlayerDefeated(player: BattlePlayerState): boolean {
    return player.hp <= 0;
}

function calculateBossHp(input: {
    playerCount: number;
    bossConfig: BossConfig;
}): number {
    const safePlayerCount = Math.min(
        Math.max(input.playerCount, 1),
        6
    ) as keyof BossHpMultiplierByPlayers;

    const multiplier = input.bossConfig.hpMultiplierByPlayers[safePlayerCount];

    return Math.round(input.bossConfig.baseHp * multiplier);
}

function getBossPhaseAfterDamage(currentHp: number, maxHp: number): BossPhase {
    if (currentHp <= 0) {
        return "defeated";
    }

    if (currentHp <= maxHp * 0.3) {
        return "rage";
    }

    if (currentHp < maxHp) {
        return "hurt";
    }

    return "idle";
}

function resolveRaidBossConfig(raid: Raid): BossConfig {
    return getBossConfig(raid.bossId ?? raid.battle?.bossId ?? raid.battle?.boss.id);
}

function resolveBattleBossConfig(battle: BattleState): BossConfig {
    return getBossConfig(battle.bossId ?? battle.boss.id);
}

function createBattleNoteSeed(input: {
    raidId: string;
    bossId: string;
    startedAt: number;
}): string {
    return `${input.raidId}:${input.bossId}:${input.startedAt}`;
}

function pickBattleInputKey(input: {
    random: RandomGenerator;
    previousKey: BattleInputKey | null;
    repeatCount: number;
}): BattleInputKey {
    const allowedKeys =
        input.previousKey && input.repeatCount >= 2
            ? BATTLE_INPUT_KEYS.filter((key) => key !== input.previousKey)
            : [...BATTLE_INPUT_KEYS];

    const index = Math.floor(input.random() * allowedKeys.length);

    return allowedKeys[Math.min(index, allowedKeys.length - 1)];
}

function createSeededRandom(seed: string): RandomGenerator {
    let state = hashStringToUint32(seed);

    return () => {
        state += 0x6d2b79f5;

        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function hashStringToUint32(value: string): number {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function isBattleInputKey(key: string): key is BattleInputKey {
    return BATTLE_INPUT_KEYS.includes(key as BattleInputKey);
}

function isBeatdownHitType(hitType: string): hitType is BeatdownHitType {
    return BEATDOWN_HIT_TYPES.includes(hitType as BeatdownHitType);
}