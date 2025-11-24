import { View, Text } from "react-native";
import React from "react";
import { Stack } from "expo-router";

const _layout = () => {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="board-1" options={{ headerShown: false }} />
      <Stack.Screen name="board-2" options={{ headerShown: false }} />
      <Stack.Screen name="board-3" options={{ headerShown: false }} />
      <Stack.Screen name="get-review" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="signin" options={{ headerShown: false }} />
      <Stack.Screen name="admin-login" options={{ headerShown: false }} />
    </Stack>
  );
};

export default _layout;
