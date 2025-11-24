import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import HomeSvg from "@/assets/svgs/HomeIcon";
import ChatSvg from "@/assets/svgs/ChatIcon";
import CampaignIcon from "@/assets/svgs/CampaignIcon";
import { CircleDollarSign } from "lucide-react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();

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
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <HomeSvg color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => <ChatSvg color={color} />,
        }}
      />
      <Tabs.Screen
        name="campaign"
        options={{
          title: "Campaign",
          tabBarIcon: ({ color }) => (
            <CircleDollarSign size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
