import { View, Text, Animated } from "react-native";
import { useEffect, useRef } from "react";

type Props = { typingUsers: string[] };

// Три підстрибуючі крапки + "Імʼя друкує"
export function TypingDots({ typingUsers }: Props) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: -4, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots]);

  if (typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0]} друкує`
      : `${typingUsers.join(", ")} друкують`;

  return (
    <View className="flex-row items-center px-4 py-1.5">
      <Text className="text-grey text-xs mr-2">{text}</Text>
      <View className="flex-row items-center gap-1">
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-primary"
            style={{ transform: [{ translateY: dot }] }}
          />
        ))}
      </View>
    </View>
  );
}
