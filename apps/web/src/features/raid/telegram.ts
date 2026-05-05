import type { CurrentUser, TelegramUser } from "./types";

export function initTelegramWebApp(): void {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
}

export function getTelegramStartParam(params: URLSearchParams): string | null {
    return (
        params.get("tgWebAppStartParam") ??
        window.Telegram?.WebApp?.initDataUnsafe?.start_param ??
        null
    );
}

export function getCurrentUser(params: URLSearchParams): CurrentUser {
    const devUserId = params.get("devUserId");
    const devName = params.get("devName");

    if (devUserId && devName) {
        return {
            id: devUserId,
            displayName: devName,
            source: "dev"
        };
    }

    const telegramUser = getTelegramUser();
    const telegramDisplayName = getTelegramDisplayName(telegramUser);

    if (telegramUser?.id && telegramDisplayName) {
        return {
            id: String(telegramUser.id),
            displayName: telegramDisplayName,
            source: "telegram"
        };
    }

    const fallbackUser = getOrCreateFallbackUser();

    return {
        id: fallbackUser.id,
        displayName: fallbackUser.displayName,
        source: "local"
    };
}

function getTelegramUser(): TelegramUser | null {
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

function getTelegramDisplayName(user: TelegramUser | null): string | null {
    if (!user) {
        return null;
    }

    if (user.username) {
        return `@${user.username}`;
    }

    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

    return fullName || null;
}

function getOrCreateFallbackUser() {
    const storageKey = "raid-game-debug-user";
    const existing = window.localStorage.getItem(storageKey);

    if (existing) {
        return JSON.parse(existing) as { id: string; displayName: string };
    }

    const user = {
        id: `debug_${crypto.randomUUID()}`,
        displayName: "Local Player"
    };

    window.localStorage.setItem(storageKey, JSON.stringify(user));

    return user;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp?: {
                initData?: string;
                initDataUnsafe?: {
                    user?: TelegramUser;
                    start_param?: string;
                };
                ready?: () => void;
                expand?: () => void;
            };
        };
    }
}