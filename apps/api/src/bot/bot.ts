import { Markup, Telegraf } from "telegraf";
import type { RaidService } from "../raids/raid.service.js";
import type { Raid } from "../raids/raid.types.js";
import { registerRaidCommand } from "./raid-command.js";
import { buildRaidResultMessage } from "./raid-result-message.js";

type StartTelegramBotOptions = {
    token: string;
    webAppUrl: string;
    miniAppUrl?: string;
    raidService: RaidService;
};

export type TelegramBotRuntime = {
    stop: (reason?: string) => void;
    sendRaidResult: (raid: Raid) => Promise<void>;
};

export async function startTelegramBot({
    token,
    webAppUrl,
    miniAppUrl,
    raidService
}: StartTelegramBotOptions): Promise<TelegramBotRuntime | null> {
    if (!token) {
        console.log("[bot] disabled: TELEGRAM_BOT_TOKEN is empty");
        return null;
    }

    const bot = new Telegraf(token);

    const botInfo = await bot.telegram.getMe();
    const webhookInfo = await bot.telegram.getWebhookInfo();

    console.log(`[bot] connected as @${botInfo.username}`);
    console.log("[bot] webhook info:", {
        url: webhookInfo.url || null,
        pendingUpdateCount: webhookInfo.pending_update_count
    });

    await bot.telegram.callApi("deleteWebhook", {
        drop_pending_updates: true
    });

    console.log("[bot] webhook deleted");

    bot.use(async (ctx, next) => {
        const message = ctx.message;

        if (message && "text" in message) {
            console.log("[bot] update received:", {
                chatId: ctx.chat?.id,
                chatType: ctx.chat?.type,
                fromId: ctx.from?.id,
                username: ctx.from?.username,
                text: message.text
            });
        } else {
            console.log("[bot] non-text update received:", {
                updateType: ctx.updateType
            });
        }

        await next();
    });

    bot.start(async (ctx) => {
        await ctx.reply("Bot is alive. Add me to a group and use /raid.");
    });

    bot.hears(/^\/ping(?:@\w+)?$/i, async (ctx) => {
        await ctx.reply("pong");
    });

    registerRaidCommand({
        bot,
        raidService,
        webAppUrl,
        miniAppUrl
    });

    bot.catch((error) => {
        console.error("[bot] runtime error:", error);
    });

    void bot
        .launch({
            dropPendingUpdates: true
        })
        .catch((error) => {
            console.error("[bot] polling failed:", error);
        });

    console.log("[bot] polling started");

    return {
        stop: (reason = "shutdown") => {
            bot.stop(reason);
        },

        sendRaidResult: async (raid: Raid) => {
            try {
                const resultMessage = buildRaidResultMessage({
                    raid,
                    webAppUrl
                });

                if (canUseTelegramButton(resultMessage.resultUrl)) {
                    await bot.telegram.sendMessage(
                        raid.telegramChatId,
                        resultMessage.text,
                        Markup.inlineKeyboard([
                            Markup.button.url(
                                resultMessage.buttonText,
                                resultMessage.resultUrl
                            )
                        ])
                    );

                    console.log("[bot] raid result sent:", {
                        raidId: raid.id,
                        chatId: raid.telegramChatId
                    });

                    return;
                }

                await bot.telegram.sendMessage(raid.telegramChatId, resultMessage.text);

                console.log("[bot] raid result local link:", {
                    raidId: raid.id,
                    resultUrl: resultMessage.resultUrl
                });
            } catch (error) {
                console.error("[bot] failed to send raid result:", {
                    raidId: raid.id,
                    chatId: raid.telegramChatId,
                    error
                });
            }
        }
    };
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