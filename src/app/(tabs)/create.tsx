import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { COLORS } from "@/constants/theme";
import { showMessage } from "@/utils/dialog";

export default function ScreenCreate() {
  const router = useRouter();
  const createRoom = useMutation(api.rooms.createRoom);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      showMessage("Помилка", "Вкажіть назву кімнати.");
      return;
    }
    setLoading(true);
    try {
      const id = await createRoom({ title, description });
      setTitle("");
      setDescription("");
      router.push({ pathname: "/chat/[id]", params: { id } });
    } catch (e) {
      console.error("Create room error", e);
      showMessage("Помилка", "Не вдалося створити кімнату.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-black p-6"
    >
      <Text className="text-white text-2xl font-bold mb-6">Нова кімната</Text>

      <TextInput
        className="bg-surface border border-surfaceLight rounded-2xl px-4 py-3.5 text-base text-white"
        placeholder="Назва кімнати"
        placeholderTextColor={COLORS.grey}
        value={title}
        onChangeText={setTitle}
        maxLength={60}
      />
      <TextInput
        className="bg-surface border border-surfaceLight rounded-2xl px-4 py-3.5 text-base text-white mt-4 min-h-[100px]"
        placeholder="Опис (необов'язково)"
        placeholderTextColor={COLORS.grey}
        value={description}
        onChangeText={setDescription}
        multiline
        textAlignVertical="top"
        maxLength={200}
      />

      <TouchableOpacity
        onPress={handleCreate}
        disabled={loading}
        activeOpacity={0.85}
        className={`bg-primary rounded-2xl py-4 mt-6 items-center ${loading ? "opacity-60" : ""}`}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-white text-base font-bold">Створити</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
