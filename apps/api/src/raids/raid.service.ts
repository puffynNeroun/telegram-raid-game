import { nanoid } from "nanoid";
import type {
    BattleAttackInput,
    BattleAttackResult,
    BattleInputActionInput,
    BattleInputActionResult,
    BattleInputKey,
    BattleInputRating,
    BattleNote,
    BattlePlayerState,
    BattleState,
    BossPhase,
    CreateRaidInput,
    CreateRaidResult,
    JoinRaidInput,
    JoinRaidResult,
    Raid,
    RaidPlayer,
    ResolveMissedNotesInput,
    ResolveMissedNotesResult,
    SetReadyInput,
    SetReadyResult,
    StartRaidInput,
    StartRaidResult,
    FinalizeExpiredBattleResult
} from "./raid.types.js";
import {
    BASE_BOSS_HP,
    BATTLE_ATTACK_DAMAGE,
    BATTLE_DURATION_SECONDS,
    BATTLE_GOOD_DAMAGE,
    BATTLE_INPUT_KEYS,
    BATTLE_MISS_DAMAGE,
    BATTLE_MISS_PLAYER_DAMAGE,
    BATTLE_NOTE_FIRST_HIT_DELAY_MS,
    BATTLE_NOTE_GOOD_WINDOW_MS,
    BATTLE_NOTE_INTERVAL_MS,
    BATTLE_NOTE_MISS_WINDOW_MS,
    BATTLE_NOTE_PERFECT_WINDOW_MS,
    BATTLE_PERFECT_DAMAGE,
    BATTLE_RESULT_TTL_SECONDS,
    BATTLE_WRONG_DAMAGE,
    BATTLE_WRONG_PLAYER_DAMAGE,
    MAX_PLAYERS_PER_RAID,
    PLAYER_MAX_HP,
    RAID_TTL_SECONDS
} from "./raid.types.js";
import type { RaidRepository } from "./raid.repository.js";

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

export class RaidService {
    constructor(private readonly raidRepository: RaidRepository) {}

    async createRaid(input: CreateRaidInput): Promise<CreateRaidResult> {
        const now = Date.now();

        const raid: Raid = {
            id: nanoid(10),
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
        const battle = this.createBattleState({
            raid,
            startedAt: now
        });

        const updatedRaid: Raid = {
            ...raid,
            status: "battle",
            battle,
            expiresAt:
                now + (BATTLE_DURATION_SECONDS + BATTLE_RESULT_TTL_SECONDS) * 1000
        };

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid
        };
    }

    async applyBattleAttack(input: BattleAttackInput): Promise<BattleAttackResult> {
        const result = await this.applyBattleDamage({
            raidId: input.raidId,
            telegramUserId: input.telegramUserId,
            damage: BATTLE_ATTACK_DAMAGE
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

        const missedResult = resolveMissedNotesInBattle(raid.battle, now);
        const raidAfterMisses = buildRaidAfterBattleChange(
            {
                ...raid,
                battle: missedResult.battle
            },
            missedResult.battle,
            now
        );

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
            telegramUserId: input.telegramUserId,
            key: input.key,
            inputAt: now
        });

        const updatedRaid = buildRaidAfterBattleChange(
            raidAfterMisses,
            inputResult.battle,
            now
        );

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
        const result = resolveMissedNotesInBattle(raid.battle, now);

        if (result.resolvedCount <= 0) {
            return {
                ok: true,
                raid,
                resolvedCount: 0
            };
        }

        const updatedRaid = buildRaidAfterBattleChange(raid, result.battle, now);

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

        const battleWithFinalMisses = resolveAllPendingNotesAsMissed(
            raid.battle,
            now
        );

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

        const updatedRaid = buildRaidAfterBattleChange(raid, battleWithPlayer, now);

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
        startedAt: number;
    }): BattleState {
        const players = Object.values(input.raid.players);
        const playerCount = players.length;
        const bossMaxHp = calculateBossHp(playerCount);

        return {
            status: "active",
            outcome: null,
            startedAt: input.startedAt,
            endsAt: input.startedAt + BATTLE_DURATION_SECONDS * 1000,
            durationSeconds: BATTLE_DURATION_SECONDS,
            boss: {
                id: "meme-boss-001",
                name: "Meme Boss",
                hp: bossMaxHp,
                maxHp: bossMaxHp,
                phase: "idle"
            },
            players: createBattlePlayers(players),
            notesByPlayer: createBattleNotesByPlayer({
                players,
                startedAt: input.startedAt,
                endsAt: input.startedAt + BATTLE_DURATION_SECONDS * 1000
            })
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

function createBattlePlayers(
    players: RaidPlayer[]
): Record<string, BattlePlayerState> {
    return Object.fromEntries(
        players.map((player) => [
            player.telegramUserId,
            {
                telegramUserId: player.telegramUserId,
                displayName: player.displayName,

                hp: PLAYER_MAX_HP,
                maxHp: PLAYER_MAX_HP,

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

function createBattleNotesByPlayer(input: {
    players: RaidPlayer[];
    startedAt: number;
    endsAt: number;
}): Record<string, BattleNote[]> {
    return Object.fromEntries(
        input.players.map((player, playerIndex) => [
            player.telegramUserId,
            createBattleNotesForPlayer({
                telegramUserId: player.telegramUserId,
                playerIndex,
                startedAt: input.startedAt,
                endsAt: input.endsAt
            })
        ])
    );
}

function createBattleNotesForPlayer(input: {
    telegramUserId: string;
    playerIndex: number;
    startedAt: number;
    endsAt: number;
}): BattleNote[] {
    const notes: BattleNote[] = [];
    const firstHitAt = input.startedAt + BATTLE_NOTE_FIRST_HIT_DELAY_MS;
    const lastHitAt = input.endsAt - BATTLE_NOTE_MISS_WINDOW_MS;

    for (
        let hitAt = firstHitAt, noteIndex = 0;
        hitAt <= lastHitAt;
        hitAt += BATTLE_NOTE_INTERVAL_MS, noteIndex += 1
    ) {
        const key =
            BATTLE_INPUT_KEYS[
            (noteIndex + input.playerIndex) % BATTLE_INPUT_KEYS.length
                ];

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
        inputAt: input.inputAt
    });

    if (!candidate) {
        const player = input.battle.players[input.telegramUserId];
        const updatedPlayer = applyFailedInputToPlayer({
            player,
            key: input.key,
            inputAt: input.inputAt,
            rating: "wrong",
            damageTaken: BATTLE_WRONG_PLAYER_DAMAGE
        });

        return {
            battle: updateBattlePlayer(input.battle, updatedPlayer),
            noteId: null,
            rating: "wrong",
            damageDealt: BATTLE_WRONG_DAMAGE,
            damageTaken: BATTLE_WRONG_PLAYER_DAMAGE,
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
            damageTaken: BATTLE_WRONG_PLAYER_DAMAGE
        });

        return {
            battle: updateBattlePlayer(input.battle, updatedPlayer),
            noteId: candidate.note.id,
            rating: "wrong",
            damageDealt: BATTLE_WRONG_DAMAGE,
            damageTaken: BATTLE_WRONG_PLAYER_DAMAGE,
            combo: updatedPlayer.combo
        };
    }

    const rating = getRatingFromTiming(candidate.distanceMs);

    if (rating === "miss") {
        const player = input.battle.players[input.telegramUserId];
        const updatedPlayer = applyFailedInputToPlayer({
            player,
            key: input.key,
            inputAt: input.inputAt,
            rating: "miss",
            damageTaken: BATTLE_MISS_PLAYER_DAMAGE
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
            damageDealt: BATTLE_MISS_DAMAGE,
            damageTaken: BATTLE_MISS_PLAYER_DAMAGE,
            combo: updatedPlayer.combo
        };
    }

    const player = input.battle.players[input.telegramUserId];
    const nextCombo = player.combo + 1;
    const damage = getDamageForRating(rating, nextCombo);

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

function resolveMissedNotesInBattle(
    battle: BattleState,
    now: number
): { battle: BattleState; resolvedCount: number } {
    let resolvedCount = 0;
    let nextBattle = battle;

    for (const [telegramUserId, notes] of Object.entries(battle.notesByPlayer)) {
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

            if (now <= note.hitAt + BATTLE_NOTE_MISS_WINDOW_MS) {
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
                    damageTaken: BATTLE_MISS_PLAYER_DAMAGE
                });
            }

            return {
                ...note,
                status: "missed",
                rating: "miss",
                resolvedAt: now,
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

function resolveAllPendingNotesAsMissed(
    battle: BattleState,
    now: number
): BattleState {
    let nextBattle = battle;

    for (const [telegramUserId, notes] of Object.entries(battle.notesByPlayer)) {
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
                    damageTaken: BATTLE_MISS_PLAYER_DAMAGE
                });
            }

            return {
                ...note,
                status: "missed",
                rating: "miss",
                resolvedAt: now,
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
}): BattleInputCandidate | null {
    let bestCandidate: BattleInputCandidate | null = null;

    input.notes.forEach((note, noteIndex) => {
        if (note.status !== "pending") {
            return;
        }

        const distanceMs = Math.abs(note.hitAt - input.inputAt);

        if (distanceMs > BATTLE_NOTE_MISS_WINDOW_MS) {
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

function getRatingFromTiming(
    distanceMs: number
): Exclude<BattleInputRating, "wrong"> {
    if (distanceMs <= BATTLE_NOTE_PERFECT_WINDOW_MS) {
        return "perfect";
    }

    if (distanceMs <= BATTLE_NOTE_GOOD_WINDOW_MS) {
        return "good";
    }

    return "miss";
}

function getDamageForRating(
    rating: Exclude<BattleInputRating, "miss" | "wrong">,
    combo: number
): number {
    const baseDamage =
        rating === "perfect" ? BATTLE_PERFECT_DAMAGE : BATTLE_GOOD_DAMAGE;

    return baseDamage + getComboBonusDamage(combo);
}

function getComboBonusDamage(combo: number): number {
    return Math.min(30, Math.floor(combo / 5) * 5);
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
    const damageDealt = Math.min(input.damage, input.battle.boss.hp);
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

function buildRaidAfterBattleChange(
    raid: Raid,
    battle: BattleState,
    finishedAt: number
): Raid {
    if (battle.boss.hp <= 0) {
        return finishBattleRaid({
            raid,
            battle,
            finishedAt,
            outcome: "win"
        });
    }

    if (areAllPlayersDefeated(battle)) {
        return finishBattleRaid({
            raid,
            battle,
            finishedAt,
            outcome: "lose"
        });
    }

    return {
        ...raid,
        status: "battle",
        battle: {
            ...battle,
            status: "active",
            outcome: null,
            boss: {
                ...battle.boss,
                phase: getBossPhaseAfterDamage(battle.boss.hp, battle.boss.maxHp)
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
        status: "finished",
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

function calculateBossHp(playerCount: number): number {
    const multipliers: Record<number, number> = {
        1: 1.0,
        2: 1.7,
        3: 2.5,
        4: 3.3,
        5: 4.1,
        6: 4.8
    };

    const safePlayerCount = Math.min(Math.max(playerCount, 1), 6);
    const multiplier = multipliers[safePlayerCount];

    return Math.round(BASE_BOSS_HP * multiplier);
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

function isBattleInputKey(key: string): key is BattleInputKey {
    return BATTLE_INPUT_KEYS.includes(key as BattleInputKey);
}