import { View, Text, Animated, ImageBackground } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import CccBigSvg from "@/assets/svgs/CccBigLogo";
import HeroBg from "@/assets/images/HeroBg.png";
import { Redirect, router } from "expo-router";
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const rootIndex = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const db = getFirestore();

  // AsyncStorage.clear();

  // Check user profile and onboarding status from Firestore
  const checkUserStatus = async (userId: string) => {
    try {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          role: userData?.role || "user",
          hasCompletedOnboarding: userData?.hasCompletedOnboarding || false,
          isAmbassador: userData?.isAmbassador || false,
          exists: true,
        };
      }
      return {
        role: "user",
        hasCompletedOnboarding: false,
        isAmbassador: false,
        exists: false,
      };
    } catch (error) {
      console.error("Error checking user status:", error);
      return {
        role: "user",
        hasCompletedOnboarding: false,
        isAmbassador: false,
        exists: false,
      };
    }
  };

  // Handle Apple display name persistence
  const handleAppleDisplayName = async (user: any) => {
    try {
      if (user.displayName) {
        // Store display name if available
        await AsyncStorage.setItem("apple_display_name", user.displayName);
        console.log("Stored Apple display name:", user.displayName);
      } else {
        // Try to retrieve stored display name if current is null
        const storedName = await AsyncStorage.getItem("apple_display_name");
        if (storedName) {
          console.log("Retrieved stored Apple display name:", storedName);
          return storedName;
        }
      }
    } catch (error) {
      console.error("Error handling Apple display name:", error);
    }
    return user.displayName;
  };

  // Handle navigation based on auth state and user status
  const handleNavigation = async () => {
    try {
      const currentUser = getAuth().currentUser;

      if (currentUser) {
        // Handle Apple display name persistence
        const displayName = await handleAppleDisplayName(currentUser);

        // User is authenticated, check their profile and onboarding status
        const userStatus = await checkUserStatus(currentUser.uid);

        // If user hasn't completed onboarding, send them back to sign in
        if (!userStatus.hasCompletedOnboarding || !userStatus.exists) {
          console.log(
            "User has not completed onboarding, redirecting to signin"
          );
          router.replace("/(onboarding)");
          return;
        }

        // User has completed onboarding, check their role
        if (userStatus.role === "admin") {
          router.replace("/(admin-tabs)/home");
        } else if (userStatus.isAmbassador) {
          router.replace("/(ambassador-tabs)/campaign-chat");
        } else {
          router.replace("/(user-tabs)/home");
        }
      } else {
        // User is not authenticated, go to onboarding
        router.replace("/(onboarding)");
      }
    } catch (error) {
      console.error("Error handling navigation:", error);
      // On error, default to onboarding
      router.replace("/(onboarding)");
    } finally {
      setIsCheckingAuth(false);
    }
  };

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Check authentication and navigate after 2.5 seconds
    const timer = setTimeout(() => {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        handleNavigation();
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ImageBackground
        source={HeroBg}
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <CccBigSvg />
      </ImageBackground>
    </Animated.View>
    // <Redirect href="/signin" />
  );
};

export default rootIndex;
