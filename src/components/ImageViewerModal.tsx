import { Modal, View, Image, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
};

// Повноекранний перегляд фото
export function ImageViewerModal({ visible, imageUrl, onClose }: Props) {
  if (!imageUrl) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black justify-center items-center">
        <TouchableOpacity
          onPress={onClose}
          className="absolute top-10 right-5 z-20 w-10 h-10 rounded-full bg-surface items-center justify-center"
        >
          <MaterialIcons name="close" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "80%" }} resizeMode="contain" />
      </View>
    </Modal>
  );
}
