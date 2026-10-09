import { useEffect, useState } from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import Svg, { Circle } from "react-native-svg";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";

type Props = {
  videoUrl: string;
  duration?: number; // секунди
  size?: number;
  onLongPress?: () => void;
};

const STROKE = 3;

// Круглий відеоплеєр: автоплей без звуку в циклі, тап вмикає/вимикає звук,
// навколо — круговий індикатор прогресу
export function VideoNotePlayer({ videoUrl, duration = 0, size = 200, onLongPress }: Props) {
  const [muted, setMuted] = useState(true);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.25;
    p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  // Реактивний прогрес: хук перерендерює компонент на кожне оновлення часу
  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: player.bufferedPosition,
  });

  const total = player.duration > 0 ? player.duration : duration;
  const progress = total > 0 ? Math.min(1, currentTime / total) : 0;

  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setMuted((m) => !m)}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <View
        style={{
          width: size - STROKE * 2 - 2,
          height: size - STROKE * 2 - 2,
          borderRadius: size,
          overflow: "hidden",
        }}
        className="bg-surfaceLight"
        pointerEvents="none"
      >
        <VideoView
          player={player}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          nativeControls={false}
        />
      </View>

      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0 }}
        pointerEvents="none"
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.primary}
          strokeWidth={STROKE}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          fill="none"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded-full flex-row items-center gap-1">
        <MaterialIcons name={muted ? "volume-off" : "volume-up"} size={12} color="#FFFFFF" />
        {total > 0 && (
          <Text className="text-[10px] text-white">{Math.round(total)} с</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
