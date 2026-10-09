import { Platform } from "react-native";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

// Завантаження локального зображення на upload URL Convex Storage.
// Web: звичайний fetch із Blob. Native: expo/fetch із File (Blob із file:// там ламається).
export async function uploadFile(uploadUrl: string, uri: string, mime = "image/jpeg") {
  let res: Response;
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": blob.type || mime },
      body: blob,
    });
  } else {
    res = (await expoFetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mime },
      body: new File(uri),
    })) as unknown as Response;
  }
  if (!res.ok) {
    const details = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${details}`);
  }
  const { storageId } = await res.json();
  return storageId as string;
}

// Зворотна сумісність: зображення завантажуються тією самою функцією
export const uploadImage = uploadFile;

// Підбирає MIME-тип за розширенням локального файлу (запис аудіо/відео)
export function guessMime(uri: string, fallback: string) {
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "m4a":
    case "mp4":
      return fallback.startsWith("audio") ? "audio/mp4" : "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return fallback.startsWith("audio") ? "audio/webm" : "video/webm";
    case "3gp":
      return fallback.startsWith("audio") ? "audio/3gpp" : "video/3gpp";
    case "aac":
      return "audio/aac";
    case "caf":
      return "audio/x-caf";
    default:
      return fallback;
  }
}
