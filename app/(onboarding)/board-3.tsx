import { View, Text, TouchableOpacity, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import React, { useEffect, useRef } from "react";
import cardsstack3 from "../../assets/images/card-stack3.png";
import { router } from "expo-router";

const Board3 = () => {
  const floatAnimation = useRef(new Animated.Value(0)).current;

  // Floating animation for image
  useEffect(() => {
    const startFloating = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnimation, {
            toValue: -8,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnimation, {
            toValue: 8,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: false }
      ).start();
    };

    startFloating();
  }, [floatAnimation]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-1 px-6 py-8">
        {/* Chat Interface Image */}
        <View className="flex-1 items-center justify-center">
          <Animated.View
            style={{
              transform: [{ translateY: floatAnimation }],
              width: "100%",
              height: 384, // equivalent to h-96
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={cardsstack3}
              style={{
                width: "100%",
                height: "100%",
              }}
              contentFit="contain"
            />
          </Animated.View>
        </View>

        {/* Content Section */}
        <View className="flex-1 justify-center items-center px-4">
          {/* Main Title */}
          <Text className="font-gBold text-[32px] text-gray-900 text-center leading-tight mb-6">
            Real-Time Creator{"\n"}Group Chats
          </Text>

          {/* Description */}
          <Text className="text-gray-600 text-[16px] text-center leading-relaxed mb-8 px-2">
            Collaborate, connect, and grow with campus creators across the
            country—right when it matters most.
          </Text>

          {/* Pagination Dots */}
          <View className="flex-row items-center justify-center mb-8">
            <View className="w-2 h-2 bg-gray-300 rounded-full mr-2" />
            <View className="w-2 h-2 bg-gray-300 rounded-full mr-2" />
            <View className="w-8 h-2 bg-gray-400 rounded-full" />
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          className="bg-[#567FE9] rounded-full py-5 mx-4 mb-8"
          activeOpacity={0.9}
          onPress={() => router.push("/get-review" as any)}
        >
          <Text className="text-white font-gBold text-[18px] text-center">
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Board3;
