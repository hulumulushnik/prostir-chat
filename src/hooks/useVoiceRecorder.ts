import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";

export type VoiceRecording = { uri: string; duration: number };

// Запис голосових повідомлень на expo-audio
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);

  // Повертає false, якщо користувач не дав доступ до мікрофона
  const start = async (): Promise<boolean> => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  };

  // Зупиняє запис і повертає файл + тривалість у секундах
  const stop = async (): Promise<VoiceRecording | null> => {
    const duration = Math.round((state.durationMillis || 0) / 1000);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    const uri = recorder.uri;
    return uri ? { uri, duration } : null;
  };

  const cancel = async () => {
    try {
      await recorder.stop();
    } catch {
      // запис міг уже бути зупинений
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  };

  return {
    isRecording: state.isRecording,
    seconds: Math.floor((state.durationMillis || 0) / 1000),
    start,
    stop,
    cancel,
  };
}
