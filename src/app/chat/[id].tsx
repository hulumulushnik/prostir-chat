import {
  View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { TypingDots } from "@/components/TypingDots";
import { MessageActionsSheet } from "@/components/MessageActionsSheet";
import { SwipeableMessageItem, type MessageItemData } from "@/components/SwipeableMessageItem";
import { ReplyPreviewBar, type ReplyTarget } from "@/components/ReplyPreviewBar";
import { confirmAction, showMessage } from "@/utils/dialog";
import { uploadFile, guessMime } from "@/utils/upload";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { VideoNoteRecorder } from "@/components/VideoNoteRecorder";

// Кількість повідомлень в одній порції пагінації (Інструкція 15)
const MESSAGES_PAGE_SIZE = 25;

type Target = {
  id: Id<"messages">;
  content?: string;
  hasImage: boolean;
  hasMedia: boolean; // голосове або кружечок: не редагуються
  isOwn: boolean;
  senderName: string;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const lastTypingSentRef = useRef(0);

  const roomId = id as Id<"chatRooms">;
  const room = useQuery(api.rooms.getRoom, { roomId });
  const {
    results: messages,
    status: pageStatus,
    loadMore,
    isLoading: messagesLoading,
  } = usePaginatedQuery(
    api.messages.getPaginatedMessages,
    { chatRoomId: roomId },
    { initialNumItems: MESSAGES_PAGE_SIZE },
  );
  const currentUser = useQuery(api.users.currentUser);
  const typingUsers = useQuery(api.typing.getTypingUsers, { chatRoomId: roomId });

  const sendMessage = useMutation(api.messages.sendMessage);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const sendMediaMessage = useMutation(api.messages.sendMediaMessage);
  const sendAudioMessage = useMutation(api.messages.sendAudioMessage);
  const sendVideoNoteMessage = useMutation(api.messages.sendVideoNoteMessage);
  const toggleReaction = useMutation(api.reactions.toggleReaction);
  const setTyping = useMutation(api.typing.setTyping);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<Target | null>(null);
  const [actionTarget, setActionTarget] = useState<Target | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedMime, setSelectedMime] = useState<string>("image/jpeg");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showTyping, setShowTyping] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const voice = useVoiceRecorder();

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

  const startReply = (msg: {
    _id: Id<"messages">;
    senderName: string;
    content?: string;
    imageUrl?: string;
    audioUrl?: string;
    videoUrl?: string;
  }) => {
    setActionTarget(null);
    // Режим редагування і відповідь взаємовиключні
    if (editing) {
      setEditing(null);
      setText("");
    }
    setReplyTarget({
      messageId: msg._id,
      senderName: msg.senderName,
      text:
        msg.content ||
        (msg.audioUrl
          ? "🎤 Голосове повідомлення"
          : msg.videoUrl
            ? "📹 Відеокружечок"
            : msg.imageUrl
              ? "📷 Фотографія"
              : ""),
    });
  };

  const startEditing = (target: Target) => {
    setActionTarget(null);
    setReplyTarget(null);
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

  const replyPayload = replyTarget
    ? {
        replyToId: replyTarget.messageId as Id<"messages">,
        replyToSender: replyTarget.senderName,
        replyToText: replyTarget.text,
      }
    : {};

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
        const storageId = await uploadFile(uploadUrl, selectedImageUri, selectedMime);
        await sendMediaMessage({
          chatRoomId: roomId,
          storageId: storageId as Id<"_storage">,
          caption: text,
          ...replyPayload,
        });
        setSelectedImageUri(null);
        setReplyTarget(null);
        setText("");
      } else {
        await sendMessage({ chatRoomId: roomId, content: text, ...replyPayload });
        setReplyTarget(null);
        setText("");
      }
    } catch (e) {
      console.error("Send error", e);
      showMessage("Помилка", "Не вдалося виконати дію.");
    } finally {
      setSending(false);
    }
  };

  // ---------- Інструкція 12: голосові повідомлення ----------

  const startVoice = async () => {
    try {
      const ok = await voice.start();
      if (!ok) {
        showMessage("Дозвіл не надано", "Для запису голосових повідомлень потрібен доступ до мікрофона.");
      }
    } catch (e) {
      console.error("Voice start error", e);
      showMessage("Помилка", "Не вдалося розпочати запис аудіо.");
    }
  };

  const cancelVoice = async () => {
    await voice.cancel();
  };

  const sendVoice = async () => {
    if (voiceBusy) return;
    setVoiceBusy(true);
    try {
      const rec = await voice.stop();
      if (!rec || rec.duration < 1) {
        showMessage("Занадто коротке", "Голосове повідомлення занадто коротке.");
        return;
      }
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadFile(uploadUrl, rec.uri, guessMime(rec.uri, "audio/mp4"));
      await sendAudioMessage({
        chatRoomId: roomId,
        audioStorageId: storageId as Id<"_storage">,
        audioDuration: rec.duration,
        ...replyPayload,
      });
      setReplyTarget(null);
    } catch (e) {
      console.error("Voice send error", e);
      showMessage("Помилка", "Не вдалося надіслати голосове повідомлення.");
    } finally {
      setVoiceBusy(false);
    }
  };

  // ---------- Інструкція 14: відеокружечки ----------

  const sendVideoNote = async (uri: string, duration: number) => {
    const uploadUrl = await generateUploadUrl();
    const storageId = await uploadFile(uploadUrl, uri, guessMime(uri, "video/mp4"));
    await sendVideoNoteMessage({
      chatRoomId: roomId,
      videoStorageId: storageId as Id<"_storage">,
      videoDuration: duration,
      ...replyPayload,
    });
    setReplyTarget(null);
  };

  // ---------- Інструкція 13: реакції ----------

  const handleReact = async (messageId: Id<"messages">, emoji: string) => {
    try {
      await toggleReaction({ messageId, emoji });
    } catch (e) {
      console.error("Reaction error", e);
      showMessage("Помилка", "Не вдалося змінити реакцію.");
    }
  };

  // ---------- Інструкція 15: довантаження історії при скролі вгору ----------

  const handleLoadMore = () => {
    if (pageStatus === "CanLoadMore") loadMore(MESSAGES_PAGE_SIZE);
  };

  const showMicButton =
    !editing && !text.trim() && !selectedImageUri && !voice.isRecording;

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

      {/* Повідомлення (інвертований список: найновіші внизу) */}
      {messagesLoading && messages.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m._id}
          inverted
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          ListFooterComponent={
            pageStatus === "LoadingMore" ? (
              <View className="py-4 items-center w-full">
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            // Інвертований список віддзеркалює вміст, тому повертаємо його назад
            <View
              className="flex-1 items-center justify-center py-20"
              style={{ transform: [{ scaleY: -1 }] }}
            >
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
              hasMedia: !!item.audioUrl || !!item.videoUrl,
              isOwn: isMe,
              senderName: item.senderName,
            };
            return (
              <SwipeableMessageItem
                item={item as MessageItemData}
                isMe={isMe}
                onLongPress={() => setActionTarget(target)}
                onReply={startReply}
                onImagePress={setFullscreenImage}
                onToggleReaction={handleReact}
                onAuthorPress={(userId) =>
                  router.push({ pathname: "/user/[id]", params: { id: userId } })
                }
              />
            );
          }}
        />
      )}

      {/* Хтось друкує */}
      {showTyping && typingUsers && typingUsers.length > 0 && (
        <TypingDots typingUsers={typingUsers.map((u) => u.name)} />
      )}

      {/* Відповідь на повідомлення */}
      {replyTarget && (
        <ReplyPreviewBar replyTarget={replyTarget} onCancel={() => setReplyTarget(null)} />
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
      {voice.isRecording || voiceBusy ? (
        <View className="px-3 py-2 border-t border-surfaceLight flex-row items-center gap-3">
          <TouchableOpacity
            onPress={cancelVoice}
            disabled={voiceBusy}
            activeOpacity={0.8}
            className={`w-11 h-11 rounded-2xl bg-surface items-center justify-center ${
              voiceBusy ? "opacity-40" : ""
            }`}
          >
            <MaterialIcons name="delete-outline" size={22} color={COLORS.danger} />
          </TouchableOpacity>

          <View className="flex-1 flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-danger mr-2" />
            <Text className="text-white text-base">
              {voiceBusy
                ? "Надсилання..."
                : `${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, "0")}`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={sendVoice}
            disabled={voiceBusy}
            activeOpacity={0.8}
            className="w-11 h-11 rounded-2xl bg-primary items-center justify-center"
          >
            {voiceBusy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="send" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
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

          <TouchableOpacity
            onPress={() => setVideoRecorderOpen(true)}
            disabled={sending || !!editing}
            activeOpacity={0.8}
            className={`w-11 h-11 rounded-2xl bg-surface items-center justify-center ${
              sending || editing ? "opacity-40" : ""
            }`}
          >
            <MaterialIcons name="videocam" size={22} color={COLORS.primary} />
          </TouchableOpacity>

          <TextInput
            className="flex-1 bg-surface border border-surfaceLight rounded-2xl px-4 py-2.5 text-white text-base max-h-28 min-h-[42px]"
            placeholder={
              editing
                ? "Змініть текст..."
                : replyTarget
                  ? `Відповідь для ${replyTarget.senderName}...`
                  : selectedImageUri
                    ? "Додайте опис до фото..."
                    : "Повідомлення..."
            }
            placeholderTextColor={COLORS.grey}
            value={text}
            onChangeText={handleTextChange}
            multiline
          />

          {showMicButton ? (
            <TouchableOpacity
              onPress={startVoice}
              disabled={sending}
              activeOpacity={0.8}
              className="w-11 h-11 rounded-2xl bg-primary items-center justify-center"
            >
              <MaterialIcons name="mic" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
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
          )}
        </View>
      )}

      <MessageActionsSheet
        visible={!!actionTarget}
        onClose={() => setActionTarget(null)}
        activeReactions={
          messages
            .find((x) => x._id === actionTarget?.id)
            ?.reactions.filter((r) => r.hasReacted)
            .map((r) => r.emoji) ?? []
        }
        onReact={(emoji) => {
          if (!actionTarget) return;
          const id = actionTarget.id;
          setActionTarget(null);
          handleReact(id, emoji);
        }}
        onReply={() => {
          if (!actionTarget) return;
          const m = messages.find((x) => x._id === actionTarget.id);
          if (m) startReply(m);
        }}
        onEdit={
          actionTarget?.isOwn && !actionTarget.hasMedia
            ? () => startEditing(actionTarget)
            : undefined
        }
        onDelete={
          actionTarget?.isOwn ? () => handleDelete(actionTarget) : undefined
        }
      />

      <VideoNoteRecorder
        visible={videoRecorderOpen}
        onClose={() => setVideoRecorderOpen(false)}
        onSendVideo={sendVideoNote}
      />

      <ImageViewerModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
    </KeyboardAvoidingView>
  );
}
