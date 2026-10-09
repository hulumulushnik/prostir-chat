import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import {
  CameraView,
  type CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import { showMessage } from "@/utils/dialog";

const MAX_SECONDS = 60;

type Props = {
  visible: boolean;
  onClose: () => void;
  // Має завантажити відео і надіслати повідомлення; кидає помилку, якщо не вдалося
  onSendVideo: (videoUri: string, durationSeconds: number) => Promise<void>;
};

const formatSeconds = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Модальне вікно запису відеокружечка (до 60 с)
export function VideoNoteRecorder({ visible, onClose, onSendVideo }: Props) {
  const [facing, setFacing] = useState<CameraType>("front");
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const cameraRef = useRef<CameraView | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Запитуємо дозволи при відкритті вікна і скидаємо стан при закритті
  useEffect(() => {
    if (visible) {
      if (!cameraPermission?.granted) requestCameraPermission();
      if (!micPermission?.granted) requestMicPermission();
    } else {
      stopTimer();
      setIsRecording(false);
      setIsProcessing(false);
      setCameraReady(false);
      setSeconds(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => stopTimer, []);

  const hasPermissions = !!cameraPermission?.granted && !!micPermission?.granted;

  const startRecording = async () => {
    if (!cameraRef.current || isRecording || !cameraReady || !hasPermissions) return;

    cancelledRef.current = false;
    startedAtRef.current = Date.now();
    setSeconds(0);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setSeconds(Math.min(elapsed, MAX_SECONDS));
    }, 250);

    try {
      // Проміс завершується після stopRecording() або по досягненню maxDuration
      const video = await cameraRef.current.recordAsync({ maxDuration: MAX_SECONDS });
      stopTimer();
      setIsRecording(false);

      if (cancelledRef.current || !video?.uri) return;

      const duration = Math.min(
        MAX_SECONDS,
        Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
      );
      setIsProcessing(true);
      try {
        await onSendVideo(video.uri, duration);
        onClose();
      } catch (e) {
        console.error("Video note send error", e);
        showMessage("Помилка", "Не вдалося надіслати відеокружечок.");
      } finally {
        setIsProcessing(false);
      }
    } catch (e) {
      console.error("Video record error", e);
      stopTimer();
      setIsRecording(false);
      showMessage("Помилка", "Не вдалося записати відео.");
    }
  };

  const stopRecording = () => {
    if (isRecording) cameraRef.current?.stopRecording();
  };

  // Закриття під час запису скасовує його
  const handleClose = () => {
    if (isProcessing) return;
    if (isRecording) {
      cancelledRef.current = true;
      cameraRef.current?.stopRecording();
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/90 justify-center items-center px-4">
        <TouchableOpacity
          onPress={handleClose}
          disabled={isProcessing}
          className="absolute top-12 right-6 p-2 rounded-full bg-white/10"
        >
          <MaterialIcons name="close" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View className="mb-6 items-center">
          <View className="flex-row items-center bg-black/60 px-4 py-1.5 rounded-full border border-white/20">
            {isRecording && <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2" />}
            <Text className="text-white text-base">
              {formatSeconds(seconds)} / {formatSeconds(MAX_SECONDS)}
            </Text>
          </View>
        </View>

        <View className="w-72 h-72 rounded-full overflow-hidden border-4 border-primary items-center justify-center bg-surface">
          {hasPermissions ? (
            <CameraView
              ref={cameraRef}
              style={{ width: "100%", height: "100%" }}
              facing={facing}
              mode="video"
              onCameraReady={() => setCameraReady(true)}
            />
          ) : (
            <Text className="text-grey text-sm text-center px-8">
              Дозвольте доступ до камери та мікрофона в налаштуваннях пристрою
            </Text>
          )}

          {isProcessing && (
            <View className="absolute inset-0 bg-black/70 items-center justify-center">
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text className="text-white text-xs font-semibold mt-2">Надсилання...</Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center justify-center gap-8 mt-10">
          <TouchableOpacity
            disabled={isRecording || isProcessing}
            onPress={() => {
              setCameraReady(false);
              setFacing((f) => (f === "front" ? "back" : "front"));
            }}
            className={`w-12 h-12 rounded-full bg-white/10 items-center justify-center ${
              isRecording || isProcessing ? "opacity-40" : ""
            }`}
          >
            <MaterialIcons name="flip-camera-android" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isProcessing || !hasPermissions || (!isRecording && !cameraReady)}
            activeOpacity={0.8}
            className={`w-20 h-20 rounded-full items-center justify-center border-4 ${
              isRecording ? "border-red-500 bg-red-500/30" : "border-white bg-primary"
            } ${!hasPermissions || (!isRecording && !cameraReady) ? "opacity-40" : ""}`}
          >
            <MaterialIcons
              name={isRecording ? "stop" : "fiber-manual-record"}
              size={36}
              color={isRecording ? "#EF4444" : "#FFFFFF"}
            />
          </TouchableOpacity>

          <View className="w-12 h-12" />
        </View>
      </View>
    </Modal>
  );
}
