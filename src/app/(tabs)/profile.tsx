import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { MaterialIcons } from "@expo/vector-icons";
import { api } from "@convex/_generated/api";
import { COLORS } from "@/constants/theme";
import { confirmAction } from "@/utils/dialog";
import { EditProfileModal } from "@/components/EditProfileModal";
import { ProfileView } from "@/components/ProfileView";

export default function ScreenProfile() {
  const user = useQuery(api.users.currentUser);
  const profile = useQuery(api.users.getUserProfile, user ? { userId: user._id } : "skip");
  const { signOut } = useAuthActions();
  const [editOpen, setEditOpen] = useState(false);

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
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{ padding: 20, paddingBottom: 90 }}
    >
      <ProfileView
        fullname={user?.fullname ?? ""}
        username={user?.username ?? ""}
        image={user?.image || undefined}
        bio={user?.bio}
        email={user?.email}
        createdAt={user?._creationTime}
        stats={profile?.stats}
      />

      <TouchableOpacity
        onPress={() => setEditOpen(true)}
        activeOpacity={0.8}
        className="bg-primary rounded-2xl py-4 flex-row items-center justify-center mb-3"
      >
        <MaterialIcons name="edit" size={20} color="#FFFFFF" />
        <Text className="text-white text-base font-bold ml-2">Редагувати профіль</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleSignOut}
        activeOpacity={0.8}
        className="bg-danger/20 border border-danger/30 rounded-2xl py-4 flex-row items-center justify-center"
      >
        <MaterialIcons name="logout" size={20} color={COLORS.danger} />
        <Text className="text-danger text-base font-bold ml-2">Вийти з акаунту</Text>
      </TouchableOpacity>

      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        currentUser={
          user
            ? { fullname: user.fullname, username: user.username, bio: user.bio, image: user.image }
            : null
        }
      />
    </ScrollView>
  );
}
