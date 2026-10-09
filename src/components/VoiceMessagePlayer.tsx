import { useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";

type Props = {
  audioUrl: string;
  duration?: number; // секунди (з бази, поки плеєр не завантажив метадані)
  isMe?: boolean;
};

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Плеєр голосового повідомлення: play/pause, прогрес і таймер
export function VoiceMessagePlayer({ audioUrl, duration = 0, isMe = false }: Props) {
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  // Відтворення має працювати і при вимкненому звуку на iOS, і після запису
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  }, []);

  // Після завершення повертаємо на початок, щоб можна було слухати знову
  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0).catch(() => {});
  }, [status.didJustFinish, player]);

  const total = status.duration > 0 ? status.duration : duration;
  const progress = total > 0 ? Math.min(status.currentTime / total, 1) : 0;

  const toggle = () => {
    if (status.playing) player.pause();
    else player.play();
  };

  const trackBg = isMe ? "bg-white/30" : "bg-surfaceLight";
  const fillBg = isMe ? "bg-white" : "bg-primary";
  const textColor = isMe ? "text-white/80" : "text-grey";

  return (
    <View className="flex-row items-center gap-3 py-1 min-w-[210px]">
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.8}
        className={`w-10 h-10 rounded-full items-center justify-center ${
          isMe ? "bg-white" : "bg-primary"
        }`}
      >
        <MaterialIcons
          name={status.playing ? "pause" : "play-arrow"}
          size={24}
          color={isMe ? COLORS.primary : COLORS.white}
        />
      </TouchableOpacity>

      <View className="flex-1">
        <View className={`h-1.5 rounded-full overflow-hidden mb-1.5 ${trackBg}`}>
          <View className={`h-full rounded-full ${fillBg}`} style={{ width: `${progress * 100}%` }} />
        </View>
        <View className="flex-row justify-between">
          <Text className={`text-xs ${textColor}`}>{formatTime(status.currentTime)}</Text>
          <Text className={`text-xs ${textColor}`}>{formatTime(total)}</Text>
        </View>
      </View>

      <MaterialIcons
        name="mic"
        size={16}
        color={isMe ? "rgba(255,255,255,0.7)" : COLORS.primary}
      />
    </View>
  );
}
