import { View, Text } from "react-native";
import React from "react";
import { Stack } from "expo-router";

const _layout = () => {
  return (
    <Stack initialRouteName="list">
      <Stack.Screen name="list" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sub-chat" options={{ headerShown: false }} />
      <Stack.Screen name="campaign-chat" options={{ headerShown: false }} />
    </Stack>
  );
};

export default _layout;
