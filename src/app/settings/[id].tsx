import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";
import { confirmAction, showMessage } from "@/utils/dialog";

export default function RoomSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const roomId = id as Id<"chatRooms">;

  const room = useQuery(api.rooms.getRoom, { roomId });
  const user = useQuery(api.users.currentUser);
  const deleteRoom = useMutation(api.rooms.deleteRoom);

  const isOwner = !!room && !!user && room.creatorId === user._id;

  const handleDelete = async () => {
    const ok = await confirmAction(
      "Видалити кімнату",
      "Усі повідомлення будуть видалені назавжди.",
      "Видалити",
    );
    if (!ok) return;
    try {
      await deleteRoom({ roomId });
      router.dismissTo("/");
    } catch (e) {
      console.error("Delete error", e);
      showMessage("Помилка", "Не вдалося видалити кімнату.");
    }
  };

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center px-3 py-3 border-b border-surfaceLight">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">Про кімнату</Text>
      </View>

      {room === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : room === null ? (
        <Text className="text-grey text-center mt-10">Кімнату не знайдено.</Text>
      ) : (
        <View className="p-6">
          <Text className="text-white text-2xl font-bold">{room.title}</Text>
          <Text className="text-grey text-base mt-2">
            {room.description || "Без опису"}
          </Text>
          <Text className="text-grey text-sm mt-4">Автор: {room.creatorName}</Text>

          {isOwner && (
            <TouchableOpacity
              onPress={handleDelete}
              activeOpacity={0.8}
              className="bg-danger/20 border border-danger/30 rounded-2xl py-4 mt-10 flex-row items-center justify-center"
            >
              <MaterialIcons name="delete-outline" size={20} color={COLORS.danger} />
              <Text className="text-danger text-base font-bold ml-2">Видалити кімнату</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
