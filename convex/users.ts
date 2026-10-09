import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Поточний авторизований користувач
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

// ---------- Інструкція 10: профіль та аватарка ----------

// Одноразове посилання для завантаження аватарки у Convex Storage
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");
    return await ctx.storage.generateUploadUrl();
  },
});

// Оновлення власного профілю
export const updateUserProfile = mutation({
  args: {
    fullname: v.string(),
    username: v.string(),
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized: Потрібна авторизація");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Користувача не знайдено");

    const fullname = args.fullname.trim();
    if (!fullname) throw new Error("Ім'я не може бути порожнім");

    const username = args.username.trim().replace(/^@/, "");
    if (!username) throw new Error("Нікнейм не може бути порожнім");
    if (!/^[A-Za-z0-9_.]{3,30}$/.test(username)) {
      throw new Error("Нікнейм: 3–30 символів, лише латиниця, цифри, _ та .");
    }

    // Нікнейм має бути унікальним
    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (taken && taken._id !== userId) {
      throw new Error("Цей нікнейм уже зайнятий");
    }

    const patch: {
      fullname: string;
      username: string;
      bio: string | undefined;
      image?: string;
      avatarStorageId?: typeof args.avatarStorageId;
    } = {
      fullname,
      username,
      bio: args.bio?.trim() || undefined,
    };

    if (args.avatarStorageId) {
      const imageUrl = await ctx.storage.getUrl(args.avatarStorageId);
      if (!imageUrl) throw new Error("Не вдалося отримати URL аватарки");
      // Видаляємо попередню аватарку зі сховища, щоб не накопичувати сміття
      if (user.avatarStorageId && user.avatarStorageId !== args.avatarStorageId) {
        await ctx.storage.delete(user.avatarStorageId);
      }
      patch.image = imageUrl;
      patch.avatarStorageId = args.avatarStorageId;
    }

    await ctx.db.patch(userId, patch);
    return { success: true };
  },
});

// Публічний профіль будь-якого користувача зі статистикою активності
export const getUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return null;

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", args.userId))
      .collect();
    const rooms = await ctx.db
      .query("chatRooms")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.userId))
      .collect();

    return {
      _id: user._id,
      fullname: user.fullname,
      username: user.username,
      image: user.image || undefined,
      bio: user.bio,
      _creationTime: user._creationTime,
      stats: {
        messagesCount: messages.length,
        roomsCreatedCount: rooms.length,
      },
    };
  },
});
