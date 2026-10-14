// app.config.ts
/// <reference types="node" />
import { ConfigContext, ExpoConfig } from "expo/config";
import { existsSync } from "fs";

const APP_NAME = "Prostir";
const PACKAGE_NAME = "com.prostir.app";
const SCHEME = "prostir";

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment =
    (process.env.APP_ENV as "development" | "preview" | "production") ||
    "development";

  console.log("⚙️  Поточне середовище збірки:", environment);
  console.log("📦 URL бази даних Convex:", process.env.EXPO_PUBLIC_CONVEX_URL);

  const isDev = environment === "development";

  // ДЗ 14: файл Firebase (FCM v1). Підключаємо лише якщо він є, щоб збірка
  // без нього не падала. Package name у Firebase має збігатися з android.package!
  const googleServicesFile = existsSync("./google-services.json")
    ? "./google-services.json"
    : undefined;

  // ДЗ 14: EAS projectId потрібен для getExpoPushTokenAsync.
  // Отримати: `npx eas-cli@latest init` (або expo.dev → Project → ID),
  // потім додати в .env.local: EAS_PROJECT_ID=xxxxxxxx-xxxx-...
  const easProjectId = process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId;

  return {
    ...config,
    name: isDev ? `${APP_NAME} Dev` : APP_NAME,
    slug: "prostir",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: isDev ? `${SCHEME}-dev` : SCHEME,
    userInterfaceStyle: "automatic",

    ios: {
      icon: "./assets/expo.icon",
      bundleIdentifier: isDev ? `${PACKAGE_NAME}.dev` : PACKAGE_NAME,
      infoPlist: {
        NSCameraUsageDescription:
          "Додатку Prostir потрібен доступ до камери для запису круглих відеоповідомлень.",
        NSMicrophoneUsageDescription:
          "Додатку Prostir потрібен доступ до мікрофона для запису звуку у відеоповідомленнях.",
      },
    },

    android: {
      package: isDev ? `${PACKAGE_NAME}.dev` : PACKAGE_NAME,
      googleServicesFile,
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.VIBRATE", // ДЗ 14: вібрація для пушів
        "android.permission.POST_NOTIFICATIONS", // ДЗ 14: Android 13+
      ],
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#208AEF",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],
      "expo-secure-store",
      [
        "expo-audio",
        {
          microphonePermission:
            "Дозвольте Prostir доступ до мікрофона для запису голосових повідомлень.",
          recordAudioAndroid: true,
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Додатку Prostir потрібен доступ до камери для запису відеокружечків.",
          microphonePermission:
            "Додатку Prostir потрібен доступ до мікрофона для запису звуку у відеокружечках.",
        },
      ],
      ["expo-video"],
      // ДЗ 14: системні сповіщення
      [
        "expo-notifications",
        {
          icon: "./assets/images/android-icon-monochrome.png", // біла іконка з прозорістю
          color: "#2563EB",
          defaultChannel: "default",
        },
      ],
    ],

    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        ...(easProjectId ? { projectId: easProjectId } : {}),
      },
    },

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  };
};
