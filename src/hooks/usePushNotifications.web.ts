// ДЗ 14: веб-версія хука.
// Нативні push-сповіщення (expo-notifications + FCM) у браузері недоступні,
// тому на web Metro підхоплює цей файл замість usePushNotifications.ts
// і модуль expo-notifications взагалі не завантажується.
export const ANDROID_CHANNEL_ID = "default";

export function usePushNotifications() {
  // no-op на web
}
