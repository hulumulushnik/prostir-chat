import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";

type Props = {
  visible: boolean;
  // Редагувати/видаляти можна лише власні повідомлення — для чужих ці пропси не передаємо
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
};

// Меню дій над повідомленням (працює і на мобільних, і в web)
export function MessageActionsSheet({ visible, onReply, onEdit, onDelete, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <View className="bg-surface border-t border-surfaceLight rounded-t-3xl p-4 pb-8">
          <Text className="text-grey text-xs text-center mb-3">Дії з повідомленням</Text>

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
        </View>
      </Pressable>
    </Modal>
  );
}
