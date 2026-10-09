import { mutation, query, MutationCtx } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

// Текст для прев'ю останнього повідомлення у списку кімнат
const previewOf = (
  m: Pick<
    Doc<"messages">,
    "content" | "imageUrl" | "audioUrl" | "videoUrl"
  >,
) => {
  if (m.audioUrl) return "🎤 Голосове повідомлення";
  if (m.videoUrl) return "📹 Відеокружечок";
  if (m.imageUrl) return `📷 ${m.content ?? "Фото"}`;
  return m.content ?? "";
};

// Видаляє повідомлення разом з усіма його файлами (фото, аудіо, відео) та реакціями.
// Використовується і в deleteMessage, і в rooms.deleteRoom.
export async function removeMessageWithAssets(
  ctx: MutationCtx,
  message: Doc<"messages">,
) {
  for (const storageId of [
    message.storageId,
    message.audioStorageId,
    message.videoStorageId,
  ]) {
    if (storageId) await ctx.storage.delete(storageId);
  }
  const reactions = await ctx.db
    .query("messageReactions")
    .withIndex("by_message", (q) => q.eq("messageId", message._id))
    .collect();
  for (const r of reactions) await ctx.db.delete(r._id);
  await ctx.db.delete(message._id);
}

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

// Інструкція 15: курсорна пагінація. Повертає порцію повідомлень від найновіших
// до найстаріших (для інвертованого FlatList). Автори та реакції підтягуються
// лише для поточної порції, а не для всієї історії.
export const getPaginatedMessages = query({
  args: {
    chatRoomId: v.id("chatRooms"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const paginated = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.chatRoomId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Ім'я та аватарка автора беруться з актуального профілю (Інструкція 10)
    const senders = new Map<Id<"users">, Doc<"users"> | null>();
    for (const id of new Set(paginated.page.map((m) => m.senderId))) {
      senders.set(id, await ctx.db.get(id));
    }

    const page = await Promise.all(
      paginated.page.map(async (m) => {
        const u = senders.get(m.senderId);

        // Інструкція 13: реакції, згруповані за емодзі
        const raw = await ctx.db
          .query("messageReactions")
          .withIndex("by_message", (q) => q.eq("messageId", m._id))
          .collect();
        const grouped = new Map<
          string,
          { emoji: string; count: number; hasReacted: boolean }
        >();
        for (const r of raw) {
          const item = grouped.get(r.emoji) ?? {
            emoji: r.emoji,
            count: 0,
            hasReacted: false,
          };
          item.count += 1;
          if (r.userId === userId) item.hasReacted = true;
          grouped.set(r.emoji, item);
        }

        return {
          ...m,
          senderName: u ? u.fullname || u.username || u.email : m.senderName,
          senderPhoto: u ? u.image || undefined : m.senderPhoto,
          reactions: Array.from(grouped.values()),
        };
      }),
    );

    return { ...paginated, page };
  },
});

// Спільні аргументи для цитування (Інструкція 9)
const replyArgs = {
  replyToId: v.optional(v.id("messages")),
  replyToSender: v.optional(v.string()),
  replyToText: v.optional(v.string()),
};

export const sendMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    content: v.string(),
    ...replyArgs,
  },
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
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
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

    if (message.audioUrl || message.videoUrl) {
      throw new Error("Голосові повідомлення та кружечки не можна редагувати");
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
        lastMessage: previewOf({
          content: content || undefined,
          imageUrl: message.imageUrl,
          audioUrl: message.audioUrl,
          videoUrl: message.videoUrl,
        }),
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

    await removeMessageWithAssets(ctx, message);

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
    ...replyArgs,
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
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
    });

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewOf({ content: caption, imageUrl }),
      lastMessageAt: Date.now(),
    });
    await clearTyping(ctx, userId, args.chatRoomId);

    return messageId;
  },
});

// ---------- Інструкція 12: голосові повідомлення ----------

export const sendAudioMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    audioStorageId: v.id("_storage"),
    audioDuration: v.number(),
    ...replyArgs,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Користувача не знайдено");

    const room = await ctx.db.get(args.chatRoomId);
    if (!room) throw new Error("Кімнату не знайдено");

    const audioUrl = await ctx.storage.getUrl(args.audioStorageId);
    if (!audioUrl) throw new Error("Не вдалося отримати URL аудіофайлу");

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.fullname || user.username || user.email,
      senderPhoto: user.image || undefined,
      audioUrl,
      audioStorageId: args.audioStorageId,
      audioDuration: Math.max(0, args.audioDuration),
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
    });

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewOf({ audioUrl }),
      lastMessageAt: Date.now(),
    });
    await clearTyping(ctx, userId, args.chatRoomId);

    return messageId;
  },
});

// ---------- Інструкція 14: відеокружечки ----------

export const sendVideoNoteMessage = mutation({
  args: {
    chatRoomId: v.id("chatRooms"),
    videoStorageId: v.id("_storage"),
    videoDuration: v.number(),
    ...replyArgs,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Користувача не знайдено");

    const room = await ctx.db.get(args.chatRoomId);
    if (!room) throw new Error("Кімнату не знайдено");

    const videoUrl = await ctx.storage.getUrl(args.videoStorageId);
    if (!videoUrl) throw new Error("Не вдалося отримати URL відеофайлу");

    const messageId = await ctx.db.insert("messages", {
      chatRoomId: args.chatRoomId,
      senderId: userId,
      senderName: user.fullname || user.username || user.email,
      senderPhoto: user.image || undefined,
      videoUrl,
      videoStorageId: args.videoStorageId,
      videoDuration: Math.max(0, args.videoDuration),
      isVideoNote: true,
      replyToId: args.replyToId,
      replyToSender: args.replyToSender,
      replyToText: args.replyToText,
    });

    await ctx.db.patch(args.chatRoomId, {
      lastMessage: previewOf({ videoUrl }),
      lastMessageAt: Date.now(),
    });
    await clearTyping(ctx, userId, args.chatRoomId);

    return messageId;
  },
});
