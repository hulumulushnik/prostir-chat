import { View, Text, TouchableOpacity, Image } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import type { Id } from "@convex/_generated/dataModel";
import { VoiceMessagePlayer } from "@/components/VoiceMessagePlayer";
import { VideoNotePlayer } from "@/components/VideoNotePlayer";
import { ReactionBadges, type ReactionSummary } from "@/components/ReactionBadges";

export type MessageItemData = {
  _id: Id<"messages">;
  _creationTime: number;
  senderId: Id<"users">;
  senderName: string;
  senderPhoto?: string;
  content?: string;
  imageUrl?: string;
  isEdited?: boolean;
  replyToId?: Id<"messages">;
  replyToSender?: string;
  replyToText?: string;
  audioUrl?: string;
  audioDuration?: number;
  videoUrl?: string;
  videoDuration?: number;
  isVideoNote?: boolean;
  reactions?: ReactionSummary[];
};

type Props = {
  item: MessageItemData;
  isMe: boolean;
  onLongPress: () => void;
  onReply: (message: MessageItemData) => void;
  onImagePress?: (url: string) => void;
  onAuthorPress?: (userId: Id<"users">) => void;
  onToggleReaction: (messageId: Id<"messages">, emoji: string) => void;
};

const SWIPE_THRESHOLD = 50;
const MAX_SWIPE = 80;

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });

export function SwipeableMessageItem({
  item,
  isMe,
  onLongPress,
  onReply,
  onImagePress,
  onAuthorPress,
  onToggleReaction,
}: Props) {
  const translateX = useSharedValue(0);
  const isVideoNote = !!item.isVideoNote && !!item.videoUrl;

  const triggerReply = () => onReply(item);

  // Свайп вправо — відповісти. Вертикальний рух віддаємо FlatList.
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX, MAX_SWIPE);
      }
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        runOnJS(triggerReply)();
      }
      translateX.value = withSpring(0, { damping: 16, stiffness: 200 });
    });

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => {
    const progress = Math.min(translateX.value / SWIPE_THRESHOLD, 1);
    return { opacity: progress, transform: [{ scale: 0.5 + progress * 0.5 }] };
  });

  return (
    <View className="relative justify-center">
      {/* Іконка відповіді, що з'являється під час свайпу */}
      <Animated.View
        style={iconStyle}
        className="absolute left-1 w-8 h-8 rounded-full bg-primary/30 items-center justify-center"
      >
        <MaterialIcons name="reply" size={18} color={COLORS.primary} />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={bubbleStyle}
          className={`flex-row items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
        >
          {!isMe && (
            <TouchableOpacity
              onPress={() => onAuthorPress?.(item.senderId)}
              activeOpacity={0.7}
              className="w-7 h-7 rounded-full bg-surface border border-surfaceLight items-center justify-center mb-1"
            >
              {item.senderPhoto ? (
                <Image source={{ uri: item.senderPhoto }} className="w-full h-full rounded-full" />
              ) : (
                <Text className="text-grey text-xs font-bold">
                  {item.senderName[0]?.toUpperCase() ?? "U"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <View className={`max-w-[78%] ${isMe ? "items-end" : "items-start"}`}>
            {isVideoNote ? (
              // Відеокружечок показується без бульбашки
              <View>
                {!isMe && (
                  <Text className="text-secondary text-xs font-bold mb-1">{item.senderName}</Text>
                )}
                <VideoNotePlayer
                  videoUrl={item.videoUrl!}
                  duration={item.videoDuration}
                  onLongPress={onLongPress}
                />
                <Text
                  className={`text-[10px] mt-1 text-grey ${isMe ? "text-right" : "text-left"}`}
                >
                  {formatTime(item._creationTime)}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                delayLongPress={300}
                onLongPress={onLongPress}
                className={`px-4 py-2.5 rounded-2xl ${
                  isMe
                    ? "bg-primary rounded-br-none"
                    : "bg-surface border border-surfaceLight rounded-bl-none"
                }`}
              >
                {!isMe && (
                  <TouchableOpacity
                    onPress={() => onAuthorPress?.(item.senderId)}
                    activeOpacity={0.7}
                    className="mb-1 self-start"
                  >
                    <Text className="text-secondary text-xs font-bold">{item.senderName}</Text>
                  </TouchableOpacity>
                )}

                {/* Цитата */}
                {item.replyToSender ? (
                  <View className="mb-2 p-2 rounded-lg bg-black/25 border-l-2 border-secondary">
                    <Text className="text-secondary font-semibold text-[11px]" numberOfLines={1}>
                      {item.replyToSender}
                    </Text>
                    <Text className="text-white/70 text-xs mt-0.5" numberOfLines={2}>
                      {item.replyToText || "📷 Фотографія"}
                    </Text>
                  </View>
                ) : null}

                {item.imageUrl ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => onImagePress?.(item.imageUrl!)}
                    onLongPress={onLongPress}
                    className="mb-1 rounded-xl overflow-hidden"
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: 220, height: 220, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : null}

                {item.audioUrl ? (
                  <VoiceMessagePlayer
                    audioUrl={item.audioUrl}
                    duration={item.audioDuration}
                    isMe={isMe}
                  />
                ) : null}

                {item.content ? (
                  <Text className="text-white text-base leading-5">{item.content}</Text>
                ) : null}

                <View className="flex-row items-center justify-end mt-1 gap-1">
                  {isMe && (
                    <TouchableOpacity
                      onPress={onLongPress}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      className="mr-1"
                    >
                      <MaterialIcons name="more-horiz" size={16} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                  )}
                  {item.isEdited && (
                    <Text className="text-white/70 text-[10px] italic">(ред.)</Text>
                  )}
                  <Text className={`text-[10px] ${isMe ? "text-white/70" : "text-grey"}`}>
                    {formatTime(item._creationTime)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Реакції під повідомленням */}
            <ReactionBadges
              reactions={item.reactions}
              isMe={isMe}
              onToggle={(emoji) => onToggleReaction(item._id, emoji)}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
