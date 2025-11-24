import { View, Text } from "react-native";
import React from "react";
import { Stack, Tabs } from "expo-router";
import { HapticTab } from "@/components/HapticTab";
import TabBarBackground from "@/components/ui/TabBarBackground";
import ChatSvg from "@/assets/svgs/ChatIcon";
import { CircleDollarSign, CircleUserRound } from "lucide-react-native";

const _layout = () => {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#567FE9",
        tabBarInactiveTintColor: "#DDD",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="campaign-chat"
        options={{
          title: "Campaign Chat",
          tabBarIcon: ({ color }) => <ChatSvg color={color} />,
        }}
      />
      <Tabs.Screen
        name="campaign-details"
        options={{
          title: "Campaign Details",
          tabBarIcon: ({ color }) => (
            <CircleDollarSign size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <CircleUserRound size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
};

export default _layout;
