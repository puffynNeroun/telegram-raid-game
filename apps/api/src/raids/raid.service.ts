import { nanoid } from "nanoid";
import type {
    BattlePlayerState,
    BattleState,
    CreateRaidInput,
    CreateRaidResult,
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
    BATTLE_DURATION_SECONDS,
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