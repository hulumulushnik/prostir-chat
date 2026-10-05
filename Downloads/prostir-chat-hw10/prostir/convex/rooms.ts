import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Список кімнат: спочатку ті, де нещодавно писали
export const listRooms = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rooms = await ctx.db.query("chatRooms").collect();
    return rooms.sort(
      (a, b) =>
        (b.lastMessageAt ?? b._creationTime) -
        (a.lastMessageAt ?? a._creationTime),
    );
  },
});

// Одна кімната + ім'я автора (null, якщо кімнату видалено)
export const getRoom = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;
    const creator = await ctx.db.get(room.creatorId);
    return { ...room, creatorName: creator?.fullname ?? "Невідомий" };
  },
});

export const createRoom = mutation({
  args: { title: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");

    const title = args.title.trim();
    if (!title) throw new Error("Назва кімнати не може бути порожньою");

    return await ctx.db.insert("chatRooms", {
      title,
      description: args.description?.trim() || undefined,
      creatorId: userId,
    });
  },
});

// Видалення кімнати і всіх її повідомлень (лише автор)
export const deleteRoom = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");

    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Кімнату не знайдено");
    if (room.creatorId !== userId) {
      throw new Error("Лише автор може видалити кімнату");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();
    for (const m of messages) {
      if (m.storageId) await ctx.storage.delete(m.storageId);
      await ctx.db.delete(m._id);
    }

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_room", (q) => q.eq("chatRoomId", args.roomId))
      .collect();
    for (const i of indicators) await ctx.db.delete(i._id);

    await ctx.db.delete(args.roomId);
  },
});
