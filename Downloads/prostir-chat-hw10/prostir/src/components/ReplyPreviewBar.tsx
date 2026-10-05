import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";

export type ReplyTarget = {
  messageId: string;
  senderName: string;
  text: string;
};

type Props = {
  replyTarget: ReplyTarget;
  onCancel: () => void;
};

// Панель над полем вводу: кому і на що відповідаємо
export function ReplyPreviewBar({ replyTarget, onCancel }: Props) {
  return (
    <View className="flex-row items-center justify-between px-4 py-2 bg-surface border-t border-surfaceLight border-l-4 border-l-primary">
      <View className="flex-row items-center flex-1 mr-2">
        <MaterialIcons name="reply" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
        <View className="flex-1">
          <Text className="text-primary font-bold text-xs" numberOfLines={1}>
            Відповідь для {replyTarget.senderName}
          </Text>
          <Text className="text-white/80 text-xs mt-0.5" numberOfLines={1}>
            {replyTarget.text || "📷 Фотографія"}
          </Text>
        </View>
      </View>

      <TouchableOpacity onPress={onCancel} className="p-1">
        <MaterialIcons name="cancel" size={20} color={COLORS.grey} />
      </TouchableOpacity>
    </View>
  );
}
