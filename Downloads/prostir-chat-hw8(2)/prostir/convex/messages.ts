import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

// Текст для прев'ю останнього повідомлення у списку кімнат
const previewOf = (m: Pick<Doc<"messages">, "content" | "imageUrl">) =>
  m.imageUrl ? `📷 ${m.content ?? "Фото"}` : (m.content ?? "");

// Після відправки повідомлення прибираємо індикатор "друкує" цього користувача
async function clearTyping(
  ctx: MutationCtx,
  userId: Id<"users">,
  chatRoomId: Id<"chatRooms">,
) {
  const indicator = await ctx.db
    .query("typingIndicators")
    .withIndex("by_user_and_room", (q) =>
      q.eq("userId", userId).eq("chatRoomId", chatRoomId),
    )
    .first();
  if (indicator) await ctx.db.delete(indicator._id);
}

// Повідомлення кімнати в хронологічному порядку
export const listMessages = query({
  args: { chatRoomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .order("asc")
      .collect();
  },
});

export const sendMessage = mutation({
  args: { chatRoomId: v.id("chatRooms"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Користувача не знайдено");

    const room = await ctx.db.get(args.chatRoomId);
    if (!room) throw new Error("Кімнату не знайдено");

    const content = args.content.trim();
    if (!content) throw new Error("Повідомлення не може бути порожнім");

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.fullname || user.username || user.email,
      senderPhoto: user.image || undefined,
      content,
    });

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: content,
      lastMessageAt: Date.now(),
    });
    await clearTyping(ctx, userId, args.chatRoomId);

    return messageId;
  },
});

// ---------- Інструкція 6: редагування та видалення ----------

export const editMessage = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Повідомлення не знайдено");
    if (message.senderId !== userId) {
      throw new Error("Forbidden: Можна редагувати лише власні повідомлення");
    }

    const content = args.content.trim();
    // Підпис до фото можна прибрати, текстове повідомлення — ні
    if (!content && !message.imageUrl) {
      throw new Error("Повідомлення не може бути порожнім");
    }

    await ctx.db.patch(args.messageId, {
      content: content || undefined,
      isEdited: true,
    });

    // Якщо це останнє повідомлення кімнати — оновлюємо прев'ю
    const last = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", message.chatRoomId))
      .order("desc")
      .first();
    if (last && last._id === args.messageId) {
      await ctx.db.patch(message.chatRoomId, {
        lastMessage: previewOf({ content: content || undefined, imageUrl: message.imageUrl }),
      });
    }
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Повідомлення не знайдено");
    if (message.senderId !== userId) {
      throw new Error("Forbidden: Можна видаляти лише власні повідомлення");
    }

    if (message.storageId) await ctx.storage.delete(message.storageId);
    await ctx.db.delete(args.messageId);

    // Оновлюємо прев'ю кімнати за останнім повідомленням, що залишилось
    const last = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", message.chatRoomId))
      .order("desc")
      .first();

    await ctx.db.patch(message.chatRoomId, {
      lastMessage: last ? previewOf(last) : undefined,
      lastMessageAt: last ? last._creationTime : undefined,
    });
  },
});

// ---------- Інструкція 7: фото ----------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendMediaMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Користувача не знайдено");

    const room = await ctx.db.get(args.chatRoomId);
    if (!room) throw new Error("Кімнату не знайдено");

    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) throw new Error("Не вдалося отримати URL зображення");

    const caption = args.caption?.trim() || undefined;

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.fullname || user.username || user.email,
      senderPhoto: user.image || undefined,
      imageUrl,
      storageId: args.storageId,
      content: caption,
    });

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewOf({ content: caption, imageUrl }),
      lastMessageAt: Date.now(),
    });
    await clearTyping(ctx, userId, args.chatRoomId);

    return messageId;
  },
});
