import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import * as Notifications from "expo-notifications";

interface NotificationPreferences {
  campaigns: boolean;
  announcements: boolean;
  webinars: boolean;
  chatMessages: boolean;
}

const NotificationSettings = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    campaigns: true,
    announcements: true,
    webinars: true,
    chatMessages: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const db = getFirestore();
  const user = getAuth().currentUser;

  // Load user's notification preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData?.notificationPreferences) {
            setPreferences(userData.notificationPreferences);
          }
        }
      } catch (error) {
        console.error("Error loading notification preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  // Save preferences to Firestore
  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        notificationPreferences: newPreferences,
        lastPreferencesUpdate: new Date(),
      });

      console.log("Notification preferences saved successfully");
    } catch (error) {
      console.error("Error saving notification preferences:", error);
      Alert.alert(
        "Error",
        "Failed to save notification preferences. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Handle preference toggle
  const togglePreference = (key: keyof NotificationPreferences) => {
    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  // Check notification permissions
  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Notifications Disabled",
        "Please enable notifications in your device settings to receive updates.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => Notifications.requestPermissionsAsync(),
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-5 py-4 border-b border-gray-100">
          <Text className="text-2xl font-bold text-gray-900">
            Notification Settings
          </Text>
          <Text className="text-gray-600 mt-1">
            Choose what notifications you'd like to receive
          </Text>
        </View>

        {/* Notification Permission Status */}
        <TouchableOpacity
          className="mx-5 mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-200"
          onPress={checkNotificationPermissions}
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
              <Ionicons name="notifications" size={20} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">
                Notification Permissions
              </Text>
              <Text className="text-gray-600 text-sm">
                Tap to check or request permissions
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </View>
        </TouchableOpacity>

        {/* Notification Types */}
        <View className="mt-8 px-5">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            Notification Types
          </Text>

          {/* Campaigns */}
          <View className="bg-gray-50 rounded-2xl mb-4">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="megaphone" size={20} color="#8B5CF6" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-medium">
                    New Campaigns
                  </Text>
                  <Text className="text-gray-600 text-sm">
                    Get notified when new campaigns are available
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.campaigns}
                onValueChange={() => togglePreference("campaigns")}
                trackColor={{ false: "#F3F4F6", true: "#3B82F6" }}
                thumbColor={preferences.campaigns ? "#FFFFFF" : "#9CA3AF"}
                disabled={saving}
              />
            </View>
          </View>

          {/* Announcements */}
          <View className="bg-gray-50 rounded-2xl mb-4">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="megaphone" size={20} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-medium">
                    Announcements
                  </Text>
                  <Text className="text-gray-600 text-sm">
                    Important updates and announcements
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.announcements}
                onValueChange={() => togglePreference("announcements")}
                trackColor={{ false: "#F3F4F6", true: "#3B82F6" }}
                thumbColor={preferences.announcements ? "#FFFFFF" : "#9CA3AF"}
                disabled={saving}
              />
            </View>
          </View>

          {/* Webinars */}
          <View className="bg-gray-50 rounded-2xl mb-4">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="videocam" size={20} color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-medium">Webinars</Text>
                  <Text className="text-gray-600 text-sm">
                    Upcoming webinars and training sessions
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.webinars}
                onValueChange={() => togglePreference("webinars")}
                trackColor={{ false: "#F3F4F6", true: "#3B82F6" }}
                thumbColor={preferences.webinars ? "#FFFFFF" : "#9CA3AF"}
                disabled={saving}
              />
            </View>
          </View>

          {/* Chat Messages */}
          <View className="bg-gray-50 rounded-2xl mb-4">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="chatbubbles" size={20} color="#F59E0B" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-medium">
                    Chat Messages
                  </Text>
                  <Text className="text-gray-600 text-sm">
                    New messages in global and campaign chats
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.chatMessages}
                onValueChange={() => togglePreference("chatMessages")}
                trackColor={{ false: "#F3F4F6", true: "#3B82F6" }}
                thumbColor={preferences.chatMessages ? "#FFFFFF" : "#9CA3AF"}
                disabled={saving}
              />
            </View>
          </View>
        </View>

        {/* Additional Information */}
        <View className="mx-5 mt-8 mb-8 p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
          <View className="flex-row items-start">
            <Ionicons
              name="information-circle"
              size={20}
              color="#F59E0B"
              className="mt-1 mr-2"
            />
            <View className="flex-1 ml-2">
              <Text className="text-yellow-800 font-medium mb-1">
                About Notifications
              </Text>
              <Text className="text-yellow-700 text-sm leading-5">
                Notifications help you stay updated with the latest campaigns,
                announcements, and messages. You can change these settings
                anytime. Some critical notifications may still be sent
                regardless of these preferences.
              </Text>
            </View>
          </View>
        </View>

        {saving && (
          <View className="mx-5 mb-4 p-3 bg-blue-50 rounded-xl">
            <Text className="text-blue-700 text-center">
              Saving preferences...
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationSettings;
