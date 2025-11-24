import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
} from "react-native";
import React, { useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as StoreReview from "expo-store-review";
import { router } from "expo-router";
import HeroBg from "@/assets/images/HeroBg.png";
import CccBigSvg from "@/assets/svgs/CccBigLogo";

const GetReview = () => {
  const insets = useSafeAreaInsets();
  const floatAnimation = useRef(new Animated.Value(0)).current;

  // Floating animation for logo
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

  // Auto-trigger review when component mounts
  useEffect(() => {
    const requestReview = async () => {
      try {
        const isAvailable = await StoreReview.hasAction();
        if (isAvailable) {
          await StoreReview.requestReview();
        } else {
          console.log("Store review not available on this device");
        }
      } catch (error) {
        console.error("Error requesting review:", error);
      }
    };

    // Small delay to let the screen render first
    const timer = setTimeout(() => {
      requestReview();
    }, 1000);

    // return () => clearTimeout(timer);
  }, []);

  return (
    <ImageBackground
      source={HeroBg}
      style={{
        flex: 1,
        paddingTop: insets.top,
      }}
    >
      <View className="flex-1 px-6 py-8">
        {/* Logo Section */}
        <View className="flex-1 items-center justify-center">
          <Animated.View
            style={{
              transform: [{ translateY: floatAnimation }],
            }}
          >
            <CccBigSvg />
          </Animated.View>
        </View>

        {/* Content Section */}
        <View className="flex-1 justify-center items-center px-4">
          {/* Review Text */}
          <Text className="font-gBold text-[28px] text-white text-center leading-tight mb-4">
            Enjoying Campus{"\n"}Creator Club?
          </Text>

          <Text className="text-white/90 text-[16px] text-center leading-relaxed mb-8 px-2">
            Help us grow by leaving a review in the App Store. Your feedback
            helps other creators discover our community!
          </Text>

          {/* Info Text */}
          <Text className="text-white/80 text-[14px] text-center leading-relaxed mb-6 px-4">
            Thank you for helping us grow!
          </Text>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          className="bg-[#567FE9] rounded-full py-5 mx-4 mb-8"
          activeOpacity={0.9}
          onPress={() => router.push("/signin" as any)}
        >
          <Text className="text-white font-gBold text-[18px] text-center">
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

export default GetReview;
