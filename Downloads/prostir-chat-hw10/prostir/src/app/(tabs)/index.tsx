import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@convex/_generated/api";
import { COLORS } from "@/constants/theme";

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });

export default function ScreenHome() {
  const router = useRouter();
  const rooms = useQuery(api.rooms.listRooms);

  if (rooms === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Text className="text-white text-2xl font-bold px-4 pt-4 pb-2">Кімнати</Text>
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
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              router.push({ pathname: "/chat/[id]", params: { id: item._id } })
            }
            className="bg-surface border border-surfaceLight rounded-2xl p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-white text-base font-bold flex-1 mr-2" numberOfLines={1}>
                {item.title}
              </Text>
              {item.lastMessageAt ? (
                <Text className="text-grey text-xs">{formatTime(item.lastMessageAt)}</Text>
              ) : null}
            </View>
            <Text className="text-grey text-sm mt-1" numberOfLines={1}>
              {item.lastMessage ?? item.description ?? "Повідомлень ще немає"}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
