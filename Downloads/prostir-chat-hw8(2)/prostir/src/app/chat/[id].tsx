import {
  View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { TypingDots } from "@/components/TypingDots";
import { MessageActionsSheet } from "@/components/MessageActionsSheet";
import { confirmAction, showMessage } from "@/utils/dialog";

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });

type Target = { id: Id<"messages">; content?: string; hasImage: boolean };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const listRef = useRef<FlatList>(null);
  const lastTypingSentRef = useRef(0);

  const roomId = id as Id<"chatRooms">;
  const room = useQuery(api.rooms.getRoom, { roomId });
  const messages = useQuery(api.messages.listMessages, { chatRoomId: roomId });
  const currentUser = useQuery(api.users.currentUser);
  const typingUsers = useQuery(api.typing.getTypingUsers, { chatRoomId: roomId });

  const sendMessage = useMutation(api.messages.sendMessage);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const sendMediaMessage = useMutation(api.messages.sendMediaMessage);
  const setTyping = useMutation(api.typing.setTyping);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<Target | null>(null);
  const [actionTarget, setActionTarget] = useState<Target | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedMime, setSelectedMime] = useState<string>("image/jpeg");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showTyping, setShowTyping] = useState(false);

  // Індикатор зникає через 3 с без нових сигналів (Convex-запит сам від часу не оновлюється)
  const typingKey = typingUsers?.map((u) => `${u.name}:${u.at}`).join("|") ?? "";
  useEffect(() => {
    if (!typingUsers || typingUsers.length === 0) {
      setShowTyping(false);
      return;
    }
    setShowTyping(true);
    const t = setTimeout(() => setShowTyping(false), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingKey]);

  const handleTextChange = (value: string) => {
    setText(value);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      setTyping({ chatRoomId: roomId }).catch(() => {});
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setSelectedImageUri(result.assets[0].uri);
      setSelectedMime(result.assets[0].mimeType ?? "image/jpeg");
    }
  };

  const startEditing = (target: Target) => {
    setActionTarget(null);
    setSelectedImageUri(null);
    setEditing(target);
    setText(target.content ?? "");
  };

  const cancelEditing = () => {
    setEditing(null);
    setText("");
  };

  const handleDelete = async (target: Target) => {
    setActionTarget(null);
    const ok = await confirmAction(
      "Видалити повідомлення",
      "Ви впевнені, що хочете видалити це повідомлення?",
      "Видалити",
    );
    if (!ok) return;
    try {
      await deleteMessage({ messageId: target.id });
      if (editing?.id === target.id) cancelEditing();
    } catch (e) {
      console.error("Delete error", e);
      showMessage("Помилка", "Не вдалося видалити повідомлення.");
    }
  };

  const canSend = editing
    ? !!text.trim() || editing.hasImage
    : !!text.trim() || !!selectedImageUri;

  const handleSend = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      if (editing) {
        await editMessage({ messageId: editing.id, content: text });
        setEditing(null);
        setText("");
      } else if (selectedImageUri) {
        const uploadUrl = await generateUploadUrl();

        // Web: звичайний fetch з Blob. Native (Expo Go / телефон): expo/fetch з File,
        // бо Blob із file:// у React Native відправляється некоректно.
        let res: Response;
        if (Platform.OS === "web") {
          const blob = await (await fetch(selectedImageUri)).blob();
          res = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": blob.type || selectedMime },
            body: blob,
          });
        } else {
          res = (await expoFetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": selectedMime },
            body: new File(selectedImageUri),
          })) as unknown as Response;
        }

        if (!res.ok) {
          const details = await res.text().catch(() => "");
          throw new Error(`Upload failed: ${res.status} ${details}`);
        }
        const { storageId } = await res.json();
        await sendMediaMessage({ chatRoomId: roomId, storageId, caption: text });
        setSelectedImageUri(null);
        setText("");
      } else {
        await sendMessage({ chatRoomId: roomId, content: text });
        setText("");
      }
    } catch (e) {
      console.error("Send error", e);
      showMessage("Помилка", "Не вдалося виконати дію.");
    } finally {
      setSending(false);
    }
  };

  if (room === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (room === null) {
    return (
      <View className="flex-1 items-center justify-center bg-black p-6">
        <Text className="text-white text-base mb-4">Кімнату не знайдено або її видалено.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary font-medium">Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-black"
    >
      {/* Шапка */}
      <View className="flex-row items-center px-3 py-3 border-b border-surfaceLight">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text className="flex-1 text-white text-lg font-bold mx-2" numberOfLines={1}>
          {room.title}
        </Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/settings/[id]", params: { id } })}
          className="p-1"
        >
          <MaterialIcons name="info-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Повідомлення */}
      {messages === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m._id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <MaterialIcons name="chat-bubble-outline" size={40} color={COLORS.grey} />
              <Text className="text-grey text-sm mt-2 text-center">
                Повідомлень ще немає. Напишіть першим!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = !!currentUser && item.senderId === currentUser._id;
            const target: Target = {
              id: item._id,
              content: item.content,
              hasImage: !!item.imageUrl,
            };
            return (
              <View className={`flex-row items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                {!isMe && (
                  <View className="w-7 h-7 rounded-full bg-surface border border-surfaceLight items-center justify-center mb-1">
                    {item.senderPhoto ? (
                      <Image source={{ uri: item.senderPhoto }} className="w-full h-full rounded-full" />
                    ) : (
                      <Text className="text-grey text-xs font-bold">
                        {item.senderName[0]?.toUpperCase() ?? "U"}
                      </Text>
                    )}
                  </View>
                )}
                <TouchableOpacity
                  activeOpacity={0.85}
                  delayLongPress={300}
                  onLongPress={isMe ? () => setActionTarget(target) : undefined}
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl ${
                    isMe
                      ? "bg-primary rounded-br-none"
                      : "bg-surface border border-surfaceLight rounded-bl-none"
                  }`}
                >
                  {!isMe && (
                    <Text className="text-secondary text-xs font-bold mb-1">{item.senderName}</Text>
                  )}

                  {item.imageUrl ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setFullscreenImage(item.imageUrl!)}
                      onLongPress={isMe ? () => setActionTarget(target) : undefined}
                      className="mb-1 rounded-xl overflow-hidden"
                    >
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={{ width: 220, height: 220, borderRadius: 12 }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : null}

                  {item.content ? (
                    <Text className="text-white text-base leading-5">{item.content}</Text>
                  ) : null}

                  <View className="flex-row items-center justify-end mt-1 gap-1">
                    {isMe && (
                      <TouchableOpacity
                        onPress={() => setActionTarget(target)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="mr-1"
                      >
                        <MaterialIcons name="more-horiz" size={16} color="rgba(255,255,255,0.8)" />
                      </TouchableOpacity>
                    )}
                    {item.isEdited && (
                      <Text className="text-white/70 text-[10px] italic">(ред.)</Text>
                    )}
                    <Text className={`text-[10px] ${isMe ? "text-white/70" : "text-grey"}`}>
                      {formatTime(item._creationTime)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Хтось друкує */}
      {showTyping && typingUsers && typingUsers.length > 0 && (
        <TypingDots typingUsers={typingUsers.map((u) => u.name)} />
      )}

      {/* Режим редагування */}
      {editing && (
        <View className="flex-row items-center justify-between px-4 py-2 bg-surface border-t border-surfaceLight">
          <View className="flex-row items-center flex-1 mr-2">
            <MaterialIcons name="edit" size={16} color={COLORS.primary} />
            <Text className="text-white text-xs font-semibold ml-1.5">Редагування повідомлення</Text>
          </View>
          <TouchableOpacity onPress={cancelEditing}>
            <MaterialIcons name="cancel" size={20} color={COLORS.grey} />
          </TouchableOpacity>
        </View>
      )}

      {/* Прев'ю вибраного фото */}
      {selectedImageUri && (
        <View className="flex-row items-center px-4 py-2 bg-surface border-t border-surfaceLight">
          <Image source={{ uri: selectedImageUri }} style={{ width: 48, height: 48, borderRadius: 8 }} />
          <Text className="text-white text-xs flex-1 ml-3">Фото додано до відправки</Text>
          <TouchableOpacity onPress={() => setSelectedImageUri(null)}>
            <MaterialIcons name="cancel" size={22} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* Введення */}
      <View className="px-3 py-2 border-t border-surfaceLight flex-row items-end gap-2">
        <TouchableOpacity
          onPress={pickImage}
          disabled={sending || !!editing}
          activeOpacity={0.8}
          className={`w-11 h-11 rounded-2xl bg-surface items-center justify-center ${
            sending || editing ? "opacity-40" : ""
          }`}
        >
          <MaterialIcons name="image" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <TextInput
          className="flex-1 bg-surface border border-surfaceLight rounded-2xl px-4 py-2.5 text-white text-base max-h-28 min-h-[42px]"
          placeholder={
            editing
              ? "Змініть текст..."
              : selectedImageUri
                ? "Додайте опис до фото..."
                : "Повідомлення..."
          }
          placeholderTextColor={COLORS.grey}
          value={text}
          onChangeText={handleTextChange}
          multiline
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend || sending}
          activeOpacity={0.8}
          className={`w-11 h-11 rounded-2xl items-center justify-center ${
            canSend && !sending ? "bg-primary" : "bg-surface"
          }`}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialIcons
              name={editing ? "check" : "send"}
              size={18}
              color={canSend ? "#FFFFFF" : COLORS.grey}
            />
          )}
        </TouchableOpacity>
      </View>

      <MessageActionsSheet
        visible={!!actionTarget}
        onClose={() => setActionTarget(null)}
        onEdit={() => actionTarget && startEditing(actionTarget)}
        onDelete={() => actionTarget && handleDelete(actionTarget)}
      />

      <ImageViewerModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
    </KeyboardAvoidingView>
  );
}
