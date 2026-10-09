import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";
import { showMessage } from "@/utils/dialog";
import { uploadImage } from "@/utils/upload";

type Props = {
  visible: boolean;
  onClose: () => void;
  currentUser: {
    fullname: string;
    username: string;
    bio?: string;
    image: string;
  } | null;
};

const inputClass =
  "bg-black border border-surfaceLight rounded-xl px-4 py-3 text-white text-base";

export function EditProfileModal({ visible, onClose, currentUser }: Props) {
  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState("image/jpeg");
  const [saving, setSaving] = useState(false);

  const updateUserProfile = useMutation(api.users.updateUserProfile);
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);

  // Підставляємо поточні дані щоразу, коли вікно відкривається
  useEffect(() => {
    if (visible && currentUser) {
      setFullname(currentUser.fullname);
      setUsername(currentUser.username);
      setBio(currentUser.bio ?? "");
      setAvatarUri(currentUser.image || null);
      setAvatarMime("image/jpeg");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
      setAvatarMime(result.assets[0].mimeType ?? "image/jpeg");
    }
  };

  const handleSave = async () => {
    if (!fullname.trim()) return showMessage("Помилка", "Ім'я не може бути порожнім.");
    if (!username.trim()) return showMessage("Помилка", "Нікнейм не може бути порожнім.");

    setSaving(true);
    try {
      let avatarStorageId: Id<"_storage"> | undefined;
      // Завантажуємо лише якщо вибрано новий файл (а не поточний https-URL)
      if (avatarUri && avatarUri !== currentUser?.image) {
        const uploadUrl = await generateAvatarUploadUrl();
        avatarStorageId = (await uploadImage(uploadUrl, avatarUri, avatarMime)) as Id<"_storage">;
      }

      await updateUserProfile({
        fullname,
        username,
        bio: bio || undefined,
        avatarStorageId,
      });
      onClose();
    } catch (e) {
      console.error("Profile save error", e);
      // Convex загортає помилку сервера; показуємо зрозумілу частину повідомлення
      const raw = e instanceof Error ? e.message : "";
      const known = ["нікнейм", "Нікнейм", "Ім'я"].some((k) => raw.includes(k));
      showMessage(
        "Помилка",
        known ? raw.replace(/^.*Error:\s*/s, "").split("\n")[0] : "Не вдалося оновити профіль.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/70"
      >
        <View className="bg-surface rounded-t-3xl border-t border-surfaceLight max-h-[90%] p-6">
          <View className="flex-row items-center justify-between pb-4 border-b border-surfaceLight">
            <Text className="text-white text-lg font-bold">Редагувати профіль</Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <MaterialIcons name="close" size={24} color={COLORS.grey} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="items-center my-5">
              <TouchableOpacity onPress={pickAvatar} disabled={saving} activeOpacity={0.8}>
                <View className="w-24 h-24 rounded-full bg-black border-2 border-primary/50 overflow-hidden items-center justify-center">
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <MaterialIcons name="person" size={44} color={COLORS.primary} />
                  )}
                </View>
                <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary items-center justify-center border-2 border-surface">
                  <MaterialIcons name="photo-camera" size={16} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <Text className="text-primary text-xs font-semibold mt-2">Змінити фотографію</Text>
            </View>

            <Text className="text-grey text-xs font-semibold uppercase mb-1.5">Ім'я *</Text>
            <TextInput
              value={fullname}
              onChangeText={setFullname}
              placeholder="Ваше повне ім'я"
              placeholderTextColor={COLORS.grey}
              className={`${inputClass} mb-4`}
            />

            <Text className="text-grey text-xs font-semibold uppercase mb-1.5">Нікнейм (@username) *</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="alex_dev"
              placeholderTextColor={COLORS.grey}
              autoCapitalize="none"
              autoCorrect={false}
              className={`${inputClass} mb-4`}
            />

            <Text className="text-grey text-xs font-semibold uppercase mb-1.5">Про себе</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Кілька слів про вас"
              placeholderTextColor={COLORS.grey}
              multiline
              maxLength={200}
              className={`${inputClass} min-h-[80px] mb-6`}
              style={{ textAlignVertical: "top" }}
            />

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
              className="bg-primary rounded-xl py-3.5 items-center justify-center mb-4"
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white font-bold text-base">Зберегти зміни</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
