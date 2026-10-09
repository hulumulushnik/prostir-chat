import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";

// Має збігатися з ALLOWED_REACTIONS у convex/reactions.ts
export const REACTION_EMOJIS = ["👍", "❤️", "🔥", "😂", "😮", "😢"];

type Props = {
  visible: boolean;
  // Емодзі, які поточний користувач уже поставив на це повідомлення
  activeReactions?: string[];
  onReact: (emoji: string) => void;
  // Редагувати/видаляти можна лише власні повідомлення — для чужих ці пропси не передаємо
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
};

// Меню дій над повідомленням (працює і на мобільних, і в web).
// Угорі — швидкі реакції (Інструкція 13).
export function MessageActionsSheet({
  visible,
  activeReactions = [],
  onReact,
  onReply,
  onEdit,
  onDelete,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-surface border-t border-surfaceLight rounded-t-3xl p-4 pb-8"
        >
          <View className="flex-row justify-between bg-surfaceLight rounded-2xl p-2 mb-3">
            {REACTION_EMOJIS.map((emoji) => {
              const active = activeReactions.includes(emoji);
              return (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => onReact(emoji)}
                  activeOpacity={0.7}
                  className={`w-12 h-12 rounded-2xl items-center justify-center ${
                    active ? "bg-primary/30 border border-primary" : ""
                  }`}
                >
                  <Text className="text-2xl">{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={onReply} className="flex-row items-center py-3.5 px-2">
            <MaterialIcons name="reply" size={22} color={COLORS.white} />
            <Text className="text-white text-base ml-3">Відповісти</Text>
          </TouchableOpacity>

          {onEdit && (
            <TouchableOpacity onPress={onEdit} className="flex-row items-center py-3.5 px-2">
              <MaterialIcons name="edit" size={22} color={COLORS.white} />
              <Text className="text-white text-base ml-3">Редагувати</Text>
            </TouchableOpacity>
          )}

          {onDelete && (
            <TouchableOpacity onPress={onDelete} className="flex-row items-center py-3.5 px-2">
              <MaterialIcons name="delete-outline" size={22} color={COLORS.danger} />
              <Text className="text-danger text-base ml-3">Видалити</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={onClose}
            className="items-center py-3.5 mt-2 bg-surfaceLight rounded-2xl"
          >
            <Text className="text-white text-base font-medium">Скасувати</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
