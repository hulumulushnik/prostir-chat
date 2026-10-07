import { View, Text, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import type { Id } from "@convex/_generated/dataModel";

export type RoomItemData = {
  _id: Id<"chatRooms">;
  title: string;
  description?: string;
  creatorId: Id<"users">;
  lastMessage?: string;
  lastMessageAt?: number;
};

type Props = {
  room: RoomItemData;
  isCreator: boolean;
  onPress: () => void;
  onDelete: (roomId: Id<"chatRooms">) => void;
};

const ACTION_WIDTH = 80; // ширина прихованої кнопки
const SPRING = { damping: 18, stiffness: 180 };

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function SwipeableRoomItem({
  room,
  isCreator,
  onPress,
  onDelete,
}: Props) {
  const translateX = useSharedValue(0);
  // Початок поточного жесту (щоб можна було закрити відкриту картку свайпом вправо)
  const startX = useSharedValue(0);

  const close = () => {
    translateX.value = withSpring(0, SPRING);
  };

  const handleDeletePress = () => {
    close();
    onDelete(room._id);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // горизонтальний жест
    .failOffsetY([-10, 10]) // вертикальний скрол віддаємо FlatList
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      if (next <= 0) {
        translateX.value = Math.max(next, -ACTION_WIDTH - 20);
      } else {
        // невеликий супротив при тязі вправо
        translateX.value = next * 0.15;
      }
    })
    .onEnd(() => {
      if (translateX.value < -ACTION_WIDTH / 2) {
        translateX.value = withSpring(-ACTION_WIDTH, SPRING);
      } else {
        translateX.value = withSpring(0, SPRING);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / ACTION_WIDTH, 1);
    return { opacity: progress, transform: [{ scale: 0.6 + 0.4 * progress }] };
  });

  return (
    <View className="relative overflow-hidden rounded-2xl">
      {/* Нижній шар з кнопкою дії */}
      <View className="absolute inset-0 bg-danger rounded-2xl flex-row justify-end items-center pr-5">
        <TouchableOpacity
          onPress={handleDeletePress}
          activeOpacity={0.8}
          className="items-center justify-center h-full px-2"
        >
          <Animated.View style={iconStyle} className="items-center">
            <MaterialIcons name="delete-outline" size={24} color="#FFFFFF" />
            <Text className="text-white text-[11px] font-bold mt-1">
              Видалити
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Верхня картка, що рухається */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (translateX.value !== 0) close();
              else onPress();
            }}
            className="bg-surface border border-surfaceLight rounded-2xl p-4"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-2 gap-1.5">
                <Text
                  className="text-white text-base font-bold flex-shrink"
                  numberOfLines={1}
                >
                  {room.title}
                </Text>
                {isCreator && (
                  <View className="bg-primary/20 px-1.5 py-0.5 rounded">
                    <Text className="text-primary text-[10px] font-semibold">
                      автор
                    </Text>
                  </View>
                )}
              </View>
              {room.lastMessageAt ? (
                <Text className="text-grey text-xs">
                  {formatTime(room.lastMessageAt)}
                </Text>
              ) : null}
            </View>
            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-grey text-sm flex-1 mr-2" numberOfLines={1}>
                {room.lastMessage ?? room.description ?? "Повідомлень ще немає"}
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={18}
                color={COLORS.grey}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
