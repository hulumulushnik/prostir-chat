import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";
import { SwipeableRoomItem } from "@/components/SwipeableRoomItem";
import { confirmAction, showMessage } from "@/utils/dialog";

export default function ScreenHome() {
  const router = useRouter();
  const rooms = useQuery(api.rooms.listRooms);
  const currentUser = useQuery(api.users.currentUser);
  const deleteRoom = useMutation(api.rooms.deleteRoom);

  const handleDeleteRoom = async (roomId: Id<"chatRooms">) => {
    const room = rooms?.find((r) => r._id === roomId);
    if (!room) return;

    if (room.creatorId !== currentUser?._id) {
      showMessage(
        "Обмеження доступу",
        "Лише автор кімнати має право видалити її для всіх учасників.",
      );
      return;
    }

    const ok = await confirmAction(
      "Видалити кімнату?",
      `Кімнату «${room.title}» та всі її повідомлення буде видалено. Цю дію неможливо скасувати.`,
      "Видалити",
    );
    if (!ok) return;

    try {
      await deleteRoom({ roomId });
    } catch (error: any) {
      showMessage("Помилка", error?.message || "Не вдалося видалити кімнату");
    }
  };

  if (rooms === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Text className="text-white text-2xl font-bold px-4 pt-4 pb-2">
        Кімнати
      </Text>
      <FlatList
        data={rooms}
        keyExtractor={(r) => r._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 90, gap: 10 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <MaterialIcons name="forum" size={44} color={COLORS.grey} />
            <Text className="text-grey text-sm mt-3 text-center">
              Кімнат ще немає. Створіть першу через кнопку «+».
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableRoomItem
            room={item}
            isCreator={item.creatorId === currentUser?._id}
            onPress={() =>
              router.push({ pathname: "/chat/[id]", params: { id: item._id } })
            }
            onDelete={handleDeleteRoom}
          />
        )}
      />
    </View>
  );
}
