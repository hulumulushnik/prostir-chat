import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";
import { ProfileView } from "@/components/ProfileView";

// Публічний профіль співрозмовника
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = id as Id<"users">;

  const profile = useQuery(api.users.getUserProfile, { userId });
  const me = useQuery(api.users.currentUser);

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center px-3 py-3 border-b border-surfaceLight">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">Профіль</Text>
      </View>

      {profile === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : profile === null ? (
        <View className="flex-1 items-center justify-center p-6">
          <MaterialIcons name="error-outline" size={48} color={COLORS.danger} />
          <Text className="text-white text-lg font-bold mt-3">Користувача не знайдено</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <ProfileView
            fullname={profile.fullname}
            username={profile.username}
            image={profile.image}
            bio={profile.bio}
            createdAt={profile._creationTime}
            stats={profile.stats}
            badge={me?._id === profile._id ? "Це ваш акаунт" : undefined}
          />
        </ScrollView>
      )}
    </View>
  );
}
