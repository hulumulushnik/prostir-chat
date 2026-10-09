import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { COLORS } from "@/constants/theme";
import { showMessage } from "@/utils/dialog";

export default function LoginScreen() {
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); // Поле для імені при реєстрації
  const [isSignUp, setIsSignUp] = useState(false); // Перемикач Вхід / Реєстрація
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      showMessage("Помилка", "Будь ласка, заповніть обов'язкові поля.");
      return;
    }

    if (isSignUp && !name.trim()) {
      showMessage("Помилка", "Будь ласка, вкажіть ваше ім'я.");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        // Реєстрація нового користувача
        await signIn("password", {
          email,
          password,
          name,
          flow: "signUp",
        });
      } else {
        // Вхід в існуючий акаунт
        await signIn("password", {
          email,
          password,
          flow: "signIn",
        });
      }
      // Після успішного входу InitialLayout автоматично перенаправить на /(tabs)
    } catch (err) {
      console.error("Auth Error", err);
      showMessage(
        "Помилка",
        isSignUp
          ? "Не вдалося створити акаунт. Можливо, пошта вже зайнята."
          : "Неправильний email або пароль.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-black"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Брендинг та логотип */}
        <View className="items-center mt-16">
          <View className="w-16 h-16 rounded-full bg-surface items-center justify-center border border-surfaceLight">
            <Ionicons
              name="accessibility-outline"
              size={28}
              color={COLORS.primary}
            />
          </View>
          <Text className="text-3xl font-bold text-white mt-4">Prostir</Text>
          <Text className="text-sm text-grey mt-2">
            {isSignUp ? "Створіть новий акаунт" : "Знайдіть нові знайомства"}
          </Text>
        </View>

        {/* Форма введення даних */}
        <View className="px-6 mt-10 w-full items-center gap-4">
          {isSignUp && (
            <View className="flex-row items-center bg-surface border border-surfaceLight rounded-2xl px-4 w-full max-w-xs">
              <Ionicons
                name="person-outline"
                size={20}
                color={COLORS.grey}
                style={{ marginRight: 12 }}
              />
              <TextInput
                className="flex-1 py-3.5 text-base text-white"
                placeholder="Ваше ім'я"
                placeholderTextColor={COLORS.grey}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View className="flex-row items-center bg-surface border border-surfaceLight rounded-2xl px-4 w-full max-w-xs">
            <Ionicons
              name="mail-outline"
              size={20}
              color={COLORS.grey}
              style={{ marginRight: 12 }}
            />
            <TextInput
              className="flex-1 py-3.5 text-base text-white"
              placeholder="Email"
              placeholderTextColor={COLORS.grey}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View className="flex-row items-center bg-surface border border-surfaceLight rounded-2xl px-4 w-full max-w-xs">
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={COLORS.grey}
              style={{ marginRight: 12 }}
            />
            <TextInput
              className="flex-1 py-3.5 text-base text-white"
              placeholder="Пароль"
              placeholderTextColor={COLORS.grey}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Кнопка відправки форми */}
          <TouchableOpacity
            className={`flex-row items-center justify-center bg-white rounded-2xl py-3.5 w-full max-w-xs mt-2.5 active:opacity-90 ${
              isLoading ? "opacity-60" : ""
            }`}
            activeOpacity={0.9}
            onPress={handleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <Text className="text-black text-base font-semibold">
                {isSignUp ? "Створити акаунт" : "Увійти"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Перемикач Вхід / Реєстрація */}
          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            className="mt-2.5 py-2"
          >
            <Text className="text-primary text-sm font-medium">
              {isSignUp
                ? "Вже є акаунт? Увійти"
                : "Немає акаунту? Зареєструватися"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
