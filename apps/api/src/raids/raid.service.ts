import { nanoid } from "nanoid";
import type {
    BattleAttackInput,
    BattleAttackResult,
    BattleInputActionInput,
    BattleInputActionResult,
    BattleInputKey,
    BattlePlayerState,
    BattleState,
    BossPhase,
    CreateRaidInput,
    CreateRaidResult,
    FinalizeExpiredBattleResult,
    JoinRaidInput,
    JoinRaidResult,
    Raid,
    RaidPlayer,
    SetReadyInput,
    SetReadyResult,
    StartRaidInput,
    StartRaidResult
} from "./raid.types.js";
import {
    BASE_BOSS_HP,
    BATTLE_ATTACK_DAMAGE,
    BATTLE_DURATION_SECONDS,
    BATTLE_INPUT_DAMAGE,
    BATTLE_RESULT_TTL_SECONDS,
    MAX_PLAYERS_PER_RAID,
    RAID_TTL_SECONDS
} from "./raid.types.js";
import type { RaidRepository } from "./raid.repository.js";

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

        const result = await this.applyBattleDamage({
            raidId: input.raidId,
            telegramUserId: input.telegramUserId,
            damage: BATTLE_INPUT_DAMAGE
        });

        if (!result.ok) {
            return result;
        }

        return {
            ok: true,
            raid: result.raid,
            key: input.key,
            damageDealt: result.damageDealt
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

        if (Date.now() < raid.battle.endsAt) {
            return {
                ok: false,
                reason: "battle_not_expired"
            };
        }

        const updatedRaid: Raid = {
            ...raid,
            status: "finished",
            battle: {
                ...raid.battle,
                status: "finished",
                outcome: "lose",
                boss: {
                    ...raid.battle.boss,
                    phase:
                        raid.battle.boss.hp <= 0
                            ? "defeated"
                            : raid.battle.boss.hp <= raid.battle.boss.maxHp * 0.3
                                ? "rage"
                                : raid.battle.boss.phase
                }
            }
        };

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
    }): Promise<
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
            | "player_not_in_battle";
    }
    > {
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

        if (Date.now() >= raid.battle.endsAt) {
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

        const damageDealt = Math.min(input.damage, raid.battle.boss.hp);
        const nextBossHp = Math.max(0, raid.battle.boss.hp - damageDealt);
        const isBossDefeated = nextBossHp <= 0;

        const updatedBattlePlayer: BattlePlayerState = {
            ...battlePlayer,
            damage: battlePlayer.damage + damageDealt
        };

        const updatedRaid: Raid = {
            ...raid,
            status: isBossDefeated ? "finished" : "battle",
            battle: {
                ...raid.battle,
                status: isBossDefeated ? "finished" : "active",
                outcome: isBossDefeated ? "win" : null,
                boss: {
                    ...raid.battle.boss,
                    hp: nextBossHp,
                    phase: getBossPhaseAfterDamage(nextBossHp, raid.battle.boss.maxHp)
                },
                players: {
                    ...raid.battle.players,
                    [input.telegramUserId]: updatedBattlePlayer
                }
            }
        };

        await this.raidRepository.saveRaid(updatedRaid);

        return {
            ok: true,
            raid: updatedRaid,
            damageDealt
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
            players: createBattlePlayers(players)
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
                hp: 100,
                maxHp: 100,
                combo: 0,
                maxCombo: 0,
                damage: 0,
                perfectCount: 0,
                goodCount: 0,
                missCount: 0,
                wrongCount: 0,
                deaths: 0,
                isStunned: false,
                stunnedUntil: null
            } satisfies BattlePlayerState
        ])
    );
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

    return "hurt";
}

function isBattleInputKey(key: string): key is BattleInputKey {
    return key === "left" || key === "up" || key === "down" || key === "right";
}