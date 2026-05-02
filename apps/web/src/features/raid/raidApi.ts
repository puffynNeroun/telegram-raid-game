import type { Raid, RaidPlayer } from "./types";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

type ApiErrorResponse = {
    ok: false;
    error?: string;
};

type ApiSuccessResponse<TPayload> = {
    ok: true;
} & TPayload;

type ApiResponse<TPayload> = ApiSuccessResponse<TPayload> | ApiErrorResponse;

type LoadRaidPayload = {
    raid: Raid;
    serverTime: number;
};

type JoinRaidPayload = {
    raid: Raid;
    player: RaidPlayer;
};

type ReadyRaidPayload = {
    raid: Raid;
    player: RaidPlayer;
};

type StartRaidPayload = {
    raid: Raid;
};

export async function loadRaidApi(raidId: string) {
    const response = await fetch(`${apiUrl}/raids/${raidId}`);
    const data = await readApiJson<LoadRaidPayload>(response);

    assertApiSuccess(response, data, "Failed to load raid");

    return {
        raid: data.raid,
        serverTime: Number(data.serverTime)
    };
}

export async function joinRaidApi(input: {
    raidId: string;
    telegramUserId: string;
    displayName: string;
}) {
    const response = await fetch(`${apiUrl}/raids/${input.raidId}/join`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegramUserId: input.telegramUserId,
            displayName: input.displayName
        })
    });

    const data = await readApiJson<JoinRaidPayload>(response);

    assertApiSuccess(response, data, "Failed to join raid");

    return {
        raid: data.raid,
        player: data.player
    };
}

export async function setReadyApi(input: {
    raidId: string;
    telegramUserId: string;
    isReady: boolean;
}) {
    const response = await fetch(`${apiUrl}/raids/${input.raidId}/ready`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegramUserId: input.telegramUserId,
            isReady: input.isReady
        })
    });

    const data = await readApiJson<ReadyRaidPayload>(response);

    assertApiSuccess(response, data, "Failed to update ready state");

    return {
        raid: data.raid,
        player: data.player
    };
}

export async function startRaidApi(input: {
    raidId: string;
    telegramUserId: string;
}) {
    const response = await fetch(`${apiUrl}/raids/${input.raidId}/start`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            telegramUserId: input.telegramUserId
        })
    });

    const data = await readApiJson<StartRaidPayload>(response);

    assertApiSuccess(response, data, "Failed to start raid");

    return {
        raid: data.raid
    };
}

async function readApiJson<TPayload>(
    response: Response
): Promise<ApiResponse<TPayload>> {
    return (await response.json()) as ApiResponse<TPayload>;
}

function assertApiSuccess<TPayload>(
    response: Response,
    data: ApiResponse<TPayload>,
    fallbackMessage: string
): asserts data is ApiSuccessResponse<TPayload> {
    if (!response.ok) {
        throw new Error(getApiErrorMessage(data, `API returned ${response.status}`));
    }

    if (isApiErrorResponse(data)) {
        throw new Error(data.error ?? fallbackMessage);
    }
}

function getApiErrorMessage(data: unknown, fallbackMessage: string): string {
    if (isApiErrorResponse(data)) {
        return data.error ?? fallbackMessage;
    }

    return fallbackMessage;
}

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
    return (
        typeof data === "object" &&
        data !== null &&
        "ok" in data &&
        (data as { ok: unknown }).ok === false
    );
}