// ДЗ 14: реєстрація Push-сповіщень та Deep Linking у кімнату чату
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { usePathname, useRouter, useSegments } from "expo-router";
import { useMutation } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/_generated/api";

export const ANDROID_CHANNEL_ID = "default";

// Кімната, яка зараз відкрита на екрані. Якщо пуш прийшов саме з неї,
// у Foreground не показуємо банер — користувач і так бачить повідомлення.
let activeRoomId: string | null = null;

/**
 * Поведінка сповіщень, коли додаток відкритий (Foreground).
 * У SDK 57 замість застарілого shouldShowAlert — shouldShowBanner / shouldShowList.
 */
// На web нативного модуля сповіщень немає — нічого не налаштовуємо
const IS_NATIVE = Platform.OS === "android" || Platform.OS === "ios";

if (IS_NATIVE)
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const roomId = notification.request.content.data?.roomId;
      const isCurrentRoom = !!roomId && roomId === activeRoomId;
      return {
        shouldShowBanner: !isCurrentRoom,
        shouldShowList: !isCurrentRoom,
        shouldPlaySound: !isCurrentRoom,
        shouldSetBadge: false,
      };
    },
  });

const roomIdFrom = (
  response: Notifications.NotificationResponse | null | undefined,
) => {
  if (
    !response ||
    response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
  ) {
    return null;
  }
  const data = response.notification.request.content.data as
    { roomId?: string; chatRoomId?: string } | undefined;
  return data?.roomId ?? data?.chatRoomId ?? null;
};

/**
 * 1. Просить дозвіл, створює Android-канал, отримує ExponentPushToken
 *    і зберігає його в Convex (users.pushToken).
 * 2. Відкриває потрібний чат /chat/[id] при натисканні на сповіщення —
 *    і коли додаток був у фоні, і при холодному старті.
 */
export function usePushNotifications() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const savePushToken = useMutation(api.users.savePushToken);
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  // Холодний старт: undefined — ще невідомо, null — сповіщень не натискали
  // IS_NATIVE — константа платформи, тож порядок хуків між рендерами не змінюється
  const lastNotificationResponse = IS_NATIVE
    ? Notifications.useLastNotificationResponse()
    : null;

  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  // Одне натискання може прийти і через хук, і через слухача — обробляємо раз
  const handledIds = useRef(new Set<string>());

  const queueNavigation = (
    response: Notifications.NotificationResponse | null | undefined,
  ) => {
    const roomId = roomIdFrom(response);
    if (!roomId || !response) return;
    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handledIds.current.has(key)) return;
    handledIds.current.add(key);
    setPendingRoomId(roomId);
  };

  // Яка кімната зараз відкрита (для приглушення банера у Foreground)
  useEffect(() => {
    const match = pathname.match(/^\/chat\/([^/]+)$/);
    activeRoomId = match ? match[1] : null;
  }, [pathname]);

  // Ефект 1: холодний старт — додаток запустили натисканням на сповіщення
  useEffect(() => {
    queueNavigation(lastNotificationResponse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastNotificationResponse]);

  // Ефект 2: натискання на сповіщення, коли додаток у фоні / відкритий
  useEffect(() => {
    if (!IS_NATIVE) return;
    const responseSub =
      Notifications.addNotificationResponseReceivedListener(queueNavigation);
    const receivedSub = Notifications.addNotificationReceivedListener((n) => {
      console.log("🔔 Сповіщення у Foreground:", n.request.content.title);
    });
    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ефект 3: перехід у чат, щойно користувач авторизований і навігатор готовий
  useEffect(() => {
    if (!pendingRoomId || isLoading || !isAuthenticated) return;
    if (!segments[0] || segments[0] === "(auth)") return; // ще йде редірект

    const target = `/chat/${pendingRoomId}`;
    setPendingRoomId(null);
    if (pathname === target) return; // вже в цій кімнаті

    // Невелика затримка, щоб стартовий редірект на /(tabs) встиг завершитись
    const timer = setTimeout(() => {
      router.push({ pathname: "/chat/[id]", params: { id: pendingRoomId } });
    }, 50);
    return () => clearTimeout(timer);
  }, [pendingRoomId, isAuthenticated, isLoading, segments, pathname, router]);

  // Ефект 4: отримання токена після входу в акаунт
  useEffect(() => {
    if (!IS_NATIVE || isLoading || !isAuthenticated) return;
    let cancelled = false;

    registerForPushNotificationsAsync().then((token) => {
      if (!token || cancelled) return;
      console.log("📲 Expo Push Token:", token);
      savePushToken({ pushToken: token }).catch((err) =>
        console.error("❌ Помилка збереження pushToken у Convex:", err),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, savePushToken]);

  // Бонус: при поверненні в додаток очищаємо бейдж на іконці
  useEffect(() => {
    if (!IS_NATIVE) return;
    Notifications.setBadgeCountAsync(0).catch(() => {});
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active")
        Notifications.setBadgeCountAsync(0).catch(() => {});
    });
    return () => sub.remove();
  }, []);
}

/** Android-канал + дозвіл + ExponentPushToken */
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!IS_NATIVE) return null;

  // Android 13+: канал треба створити ДО запиту токена
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Повідомлення чату",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB",
      sound: "default",
    });
  }

  if (!Device.isDevice) {
    console.warn(
      "⚠️ Push-сповіщення працюють лише на реальному пристрої або емуляторі з Google Play",
    );
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("⚠️ Користувач не дозволив сповіщення");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn(
      "⚠️ Немає extra.eas.projectId — виконайте `npx eas-cli init` і додайте ID у .env.local",
    );
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    console.error("❌ Помилка отримання Expo Push Token:", error);
    return null;
  }
}
