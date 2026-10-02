import { View, Text, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@convex/_generated/api";
import { COLORS } from "@/constants/theme";
import { confirmAction } from "@/utils/dialog";

export default function ScreenProfile() {
  const user = useQuery(api.users.currentUser);
  const { signOut } = useAuthActions();

  // Після виходу InitialLayout сам перенаправить на екран входу
  const handleSignOut = async () => {
    const ok = await confirmAction("Вихід з акаунта", "Ви дійсно бажаєте вийти?", "Вийти");
    if (ok) await signOut();
  };

  if (user === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black p-6 items-center">
      <View className="w-24 h-24 rounded-full bg-surface border-2 border-primary/40 items-center justify-center mt-6 mb-4">
        {user?.image ? (
          <Image source={{ uri: user.image }} className="w-full h-full rounded-full" />
        ) : (
          <MaterialIcons name="person" size={44} color={COLORS.primary} />
        )}
      </View>

      <Text className="text-white text-2xl font-bold">{user?.fullname ?? "Користувач"}</Text>
      <Text className="text-grey text-sm mt-1">@{user?.username}</Text>
      <Text className="text-grey text-sm mt-1">{user?.email}</Text>

      <TouchableOpacity
        onPress={handleSignOut}
        activeOpacity={0.8}
        className="w-full bg-danger/20 border border-danger/30 rounded-2xl py-4 mt-12 flex-row items-center justify-center"
      >
        <MaterialIcons name="logout" size={20} color={COLORS.danger} />
        <Text className="text-danger text-base font-bold ml-2">Вийти з акаунту</Text>
      </TouchableOpacity>
    </View>
  );
}
