import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Дозволений набір реакцій (синхронізовано з ReactionPicker на клієнті)
export const ALLOWED_REACTIONS = ["👍", "❤️", "🔥", "😂", "😮", "😢"];

// Поставити або зняти реакцію (toggle).
// Лічильники приходять разом із повідомленнями у getPaginatedMessages,
// тож окремого запиту на кожне повідомлення не потрібно.
export const toggleReaction = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");
    if (!ALLOWED_REACTIONS.includes(args.emoji)) {
      throw new Error("Непідтримувана реакція");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Повідомлення не знайдено");

    const mine = await ctx.db
      .query("messageReactions")
      .withIndex("by_message_and_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", userId),
      )
      .collect();
    const existing = mine.find((r) => r.emoji === args.emoji);

    if (existing) {
      await ctx.db.delete(existing._id);
      return { action: "removed" as const, emoji: args.emoji };
    }
    await ctx.db.insert("messageReactions", {
      messageId: args.messageId,
      userId,
      emoji: args.emoji,
      createdAt: Date.now(),
    });
    return { action: "added" as const, emoji: args.emoji };
  },
});
