// ДЗ 14: відправка Push-сповіщень через Expo Push Service.
// Мутації не можуть робити fetch(), тому вони планують цей екшен через
// ctx.scheduler.runAfter(0, internal.pushNotifications.sendPushNotification, ...)
import { internalAction, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const isExpoToken = (t: string) =>
  t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[");

export const sendPushNotification = internalAction({
  args: {
    pushToken: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  // Явний тип повернення розриває циклічну типізацію internal ↔ цей файл
  handler: async (ctx, args): Promise<void> => {
    if (!isExpoToken(args.pushToken)) {
      console.log("⚠️ Некоректний Expo pushToken, пропускаємо:", args.pushToken);
      return;
    }

    const message = {
      to: args.pushToken,
      sound: "default",
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      priority: "high",
      channelId: "default", // той самий канал, що створюється на клієнті
    };

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      const result = await response.json();
      console.log("📨 Push send result:", JSON.stringify(result));

      // Пристрій більше не зареєстрований — прибираємо токен з бази
      if (
        result?.data?.status === "error" &&
        result?.data?.details?.error === "DeviceNotRegistered"
      ) {
        await ctx.runMutation(internal.users.clearInvalidPushToken, {
          pushToken: args.pushToken,
        });
      }
    } catch (error) {
      console.error("❌ Помилка відправки push-сповіщення:", error);
    }
  },
});

// ---------- Хелпери для мутацій ----------

const MAX_BODY = 150;
const shorten = (s: string) =>
  s.length > MAX_BODY ? `${s.slice(0, MAX_BODY - 1)}…` : s;

export const displayName = (u: Doc<"users">) =>
  u.fullname || u.username || u.email || "Співрозмовник";

// Чи можна слати пуш цьому користувачу щодо цієї кімнати
const canNotify = (u: Doc<"users"> | null, roomId: Id<"chatRooms">) =>
  !!u?.pushToken && !(u.mutedRooms ?? []).includes(roomId);

// Планує один пуш (без очікування — мутація завершується одразу)
export async function schedulePush(
  ctx: MutationCtx,
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  await ctx.scheduler.runAfter(
    0,
    internal.pushNotifications.sendPushNotification,
    { pushToken, title, body: shorten(body), data },
  );
}

/**
 * Розсилка після нового повідомлення в кімнаті:
 *  A) якщо це Reply — автор оригіналу отримує персональний пуш із цитатою;
 *  B) решта учасників (творець кімнати + усі, хто писав у ній) — звичайний пуш.
 * Відправник і заглушені кімнати пропускаються.
 */
export async function notifyNewMessage(
  ctx: MutationCtx,
  params: {
    room: Doc<"chatRooms">;
    sender: Doc<"users">;
    messageId: Id<"messages">;
    preview: string; // текст або "🎤 Голосове повідомлення" тощо
    replyToId?: Id<"messages">;
  },
) {
  const { room, sender, messageId, preview } = params;
  const senderName = displayName(sender);
  const data = { roomId: room._id, messageId };

  // A) Reply
  let replyAuthorId: Id<"users"> | null = null;
  if (params.replyToId) {
    const original = await ctx.db.get(params.replyToId);
    if (original && original.senderId !== sender._id) {
      replyAuthorId = original.senderId;
      const author = await ctx.db.get(original.senderId);
      if (canNotify(author, room._id)) {
        const quote = original.content
          ? `«${original.content.slice(0, 40)}${original.content.length > 40 ? "…" : ""}»\n`
          : "";
        await schedulePush(
          ctx,
          author!.pushToken!,
          `↩️ ${senderName} відповів(-ла) вам у «${room.title}»`,
          `${quote}${preview}`,
          { ...data, type: "reply" },
        );
      }
    }
  }

  // B) Решта учасників кімнати
  const recipients = new Set<Id<"users">>([room.creatorId]);
  const roomMessages = await ctx.db
    .query("messages")
    .withIndex("by_chat_room", (q) => q.eq("chatRoomId", room._id))
    .collect();
  for (const m of roomMessages) recipients.add(m.senderId);
  recipients.delete(sender._id);
  if (replyAuthorId) recipients.delete(replyAuthorId); // вже отримав Reply-пуш

  const sentTokens = new Set<string>();
  for (const id of recipients) {
    const u = await ctx.db.get(id);
    if (!canNotify(u, room._id) || sentTokens.has(u!.pushToken!)) continue;
    sentTokens.add(u!.pushToken!);
    await schedulePush(
      ctx,
      u!.pushToken!,
      `${senderName} · ${room.title}`,
      preview,
      { ...data, type: "message" },
    );
  }
}

/** Пуш автору повідомлення про нову емодзі-реакцію */
export async function notifyReaction(
  ctx: MutationCtx,
  params: { message: Doc<"messages">; reactorId: Id<"users">; emoji: string },
) {
  const { message, reactorId, emoji } = params;
  if (message.senderId === reactorId) return; // на своє повідомлення — без пуша

  const [author, reactor, room] = await Promise.all([
    ctx.db.get(message.senderId),
    ctx.db.get(reactorId),
    ctx.db.get(message.chatRoomId),
  ]);
  if (!reactor || !room || !canNotify(author, room._id)) return;

  const target = message.content
    ? `«${message.content.slice(0, 40)}${message.content.length > 40 ? "…" : ""}»`
    : "ваше повідомлення";

  await schedulePush(
    ctx,
    author!.pushToken!,
    `Нова реакція ${emoji}`,
    `${displayName(reactor)} відреагував(-ла) ${emoji} на ${target} у «${room.title}»`,
    { type: "reaction", roomId: room._id, messageId: message._id },
  );
}
