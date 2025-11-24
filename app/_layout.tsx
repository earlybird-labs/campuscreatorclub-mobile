import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";

import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";
import { notificationService } from "@/services/notificationService";
import { appsFlyerService } from "@/services/appsFlyerService";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import "../global.css";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    BricolageGrotesque_700Bold,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Initialize AppsFlyer SDK on app start
  useEffect(() => {
    appsFlyerService.initialize();
  }, []);

  // Initialize notification service when user is authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (user) {
        // console.log("User authenticated", user);
        console.log("User authenticated, initializing notification service");
        await notificationService.initialize();
        
        // Set customer user ID for AppsFlyer
        appsFlyerService.setCustomerUserId(user.uid);
      }
    });

    return unsubscribe;
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(user-tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin-tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="(ambassador-tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
