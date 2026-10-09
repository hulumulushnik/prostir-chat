import { View, Text, TouchableOpacity } from "react-native";

export type ReactionSummary = {
  emoji: string;
  count: number;
  hasReacted: boolean;
};

type Props = {
  reactions?: ReactionSummary[];
  isMe?: boolean;
  onToggle: (emoji: string) => void;
};

// Бейджі реакцій під повідомленням: емодзі + лічильник, власна реакція підсвічена.
// Дані приходять разом із повідомленням (getPaginatedMessages), без окремого запиту.
export function ReactionBadges({ reactions, isMe, onToggle }: Props) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <View
      className={`flex-row flex-wrap gap-1.5 mt-1 ${isMe ? "justify-end" : "justify-start"}`}
    >
      {reactions.map((r) => (
        <TouchableOpacity
          key={r.emoji}
          onPress={() => onToggle(r.emoji)}
          activeOpacity={0.7}
          className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full border ${
            r.hasReacted
              ? "bg-primary/20 border-primary"
              : "bg-surfaceLight border-surfaceLight"
          }`}
        >
          <Text className="text-xs">{r.emoji}</Text>
          <Text
            className={`text-xs font-semibold ${
              r.hasReacted ? "text-primary" : "text-grey"
            }`}
          >
            {r.count}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
