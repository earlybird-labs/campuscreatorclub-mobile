import { View, Text } from "react-native";
import React from "react";
import { Tabs } from "expo-router";
import CampaignIcon from "@/assets/svgs/CampaignIcon";
import HomeSvg from "@/assets/svgs/HomeIcon";
import ChatSvg from "@/assets/svgs/ChatIcon";
import { CircleDollarSign } from "lucide-react-native";

const _layout = () => {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#567FE9",
        tabBarInactiveTintColor: "#DDD",
        headerShown: false,
        tabBarShowLabel: false,
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
};

export default _layout;
