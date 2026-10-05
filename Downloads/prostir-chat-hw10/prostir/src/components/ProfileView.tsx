import { View, Text, Image } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";

type Props = {
  fullname: string;
  username: string;
  image?: string;
  bio?: string;
  email?: string;
  createdAt?: number;
  stats?: { messagesCount: number; roomsCreatedCount: number };
  badge?: string;
};

function StatCard({ icon, value, label }: { icon: keyof typeof MaterialIcons.glyphMap; value: number; label: string }) {
  return (
    <View className="flex-1 bg-surface border border-surfaceLight rounded-2xl p-4 items-center">
      <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mb-2">
        <MaterialIcons name={icon} size={20} color={COLORS.primary} />
      </View>
      <Text className="text-white text-xl font-bold">{value}</Text>
      <Text className="text-grey text-xs mt-0.5">{label}</Text>
    </View>
  );
}

// Спільна картка профілю: власний екран і публічний екран співрозмовника
export function ProfileView({ fullname, username, image, bio, email, createdAt, stats, badge }: Props) {
  return (
    <View>
      <View className="items-center mt-4 mb-6">
        <View className="w-28 h-28 rounded-full bg-surface border-4 border-primary/40 items-center justify-center overflow-hidden mb-3">
          {image ? (
            <Image source={{ uri: image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <MaterialIcons name="person" size={54} color={COLORS.primary} />
          )}
        </View>

        <Text className="text-white text-2xl font-bold text-center">{fullname || "Користувач"}</Text>
        <Text className="text-primary text-sm font-semibold mt-0.5">@{username}</Text>
        {email ? <Text className="text-grey text-xs mt-1">{email}</Text> : null}

        {badge ? (
          <View className="bg-primary/20 px-2.5 py-0.5 rounded-full mt-2">
            <Text className="text-primary text-xs font-semibold">{badge}</Text>
          </View>
        ) : null}

        {bio ? (
          <View className="mt-4 px-4 py-3 bg-surface rounded-2xl border border-surfaceLight w-full">
            <Text className="text-grey text-xs font-semibold uppercase mb-1">Про себе</Text>
            <Text className="text-white text-sm leading-5">{bio}</Text>
          </View>
        ) : null}
      </View>

      {stats && (
        <View className="flex-row gap-3 mb-4">
          <StatCard icon="chat-bubble" value={stats.messagesCount} label="Повідомлень" />
          <StatCard icon="forum" value={stats.roomsCreatedCount} label="Створено кімнат" />
        </View>
      )}

      {createdAt ? (
        <View className="bg-surface border border-surfaceLight rounded-2xl p-4 flex-row items-center mb-6">
          <MaterialIcons name="event" size={20} color={COLORS.grey} />
          <Text className="text-grey text-xs ml-2.5">
            Учасник з {new Date(createdAt).toLocaleDateString("uk-UA")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
