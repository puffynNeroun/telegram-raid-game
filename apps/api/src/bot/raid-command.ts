import { Markup, type Context, type Telegraf } from "telegraf";
import type { RaidService } from "../raids/raid.service.js";
import type { Raid } from "../raids/raid.types.js";

type RegisterRaidCommandOptions = {
    bot: Telegraf<Context>;
    raidService: RaidService;
    webAppUrl: string;
};

type TelegramUser = NonNullable<Context["from"]>;

export function registerRaidCommand({
                                        bot,
                                        raidService,
                                        webAppUrl
                                    }: RegisterRaidCommandOptions): void {
    bot.hears(/^\/raid(?:@\w+)?$/i, async (ctx) => {
        if (!ctx.chat || ctx.chat.type === "private") {
            await ctx.reply("Use /raid inside a Telegram group.");
            return;
        }

        if (!ctx.from) {
            await ctx.reply("Cannot detect Telegram user.");
            return;
        }

        const result = await raidService.createRaid({
            telegramChatId: String(ctx.chat.id),
            hostTelegramUserId: String(ctx.from.id),
            hostDisplayName: getDisplayName(ctx.from)
        });

        const raid = result.ok ? result.raid : result.activeRaid;

        if (!raid) {
            await ctx.reply("A raid already exists, but I could not load it. Try again.");
            return;
        }

        let joinUrl: string;

        try {
            joinUrl = buildJoinUrl(webAppUrl, raid);
        } catch {
            await ctx.reply("Bot is misconfigured: TELEGRAM_WEB_APP_URL is invalid.");
            return;
        }

        const message = result.ok
            ? buildRaidCreatedMessage(raid)
            : buildActiveRaidExistsMessage(raid);

        if (canUseTelegramButton(joinUrl)) {
            await ctx.reply(
                message,
                Markup.inlineKeyboard([Markup.button.url("Join Raid", joinUrl)])
            );

            return;
        }

        await ctx.reply(
            [
                message,
                "",
                "Local dev link:",
                joinUrl,
                "",
                "Telegram cannot use localhost inside an inline button. Open this link manually in your browser."
            ].join("\n")
        );
    });
}

function getDisplayName(user: TelegramUser): string {
    if (user.username) {
        return `@${user.username}`;
    }

    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

    return fullName || `user_${user.id}`;
}

function buildJoinUrl(webAppUrl: string, raid: Raid): string {
    const url = new URL(webAppUrl);

    url.searchParams.set("raidId", raid.id);
    url.searchParams.set("chatId", raid.telegramChatId);

    return url.toString();
}

function canUseTelegramButton(url: string): boolean {
    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.hostname === "localhost") {
            return false;
        }

        if (parsedUrl.hostname === "127.0.0.1") {
            return false;
        }

        return parsedUrl.protocol === "https:";
    } catch {
        return false;
    }
}

function buildRaidCreatedMessage(raid: Raid): string {
    return [
        "⚔️ Raid created!",
        "",
        `Host: ${raid.hostDisplayName}`,
        "Players: 1/6",
        "Expires in: 2 minutes",
        "",
        "Tap Join Raid to enter the lobby."
    ].join("\n");
}

function buildActiveRaidExistsMessage(raid: Raid): string {
    return [
        "⏳ A raid is already active in this group.",
        "",
        `Host: ${raid.hostDisplayName}`,
        `Players: ${Object.keys(raid.players).length}/6`,
        "Use the existing Join Raid link."
    ].join("\n");
}