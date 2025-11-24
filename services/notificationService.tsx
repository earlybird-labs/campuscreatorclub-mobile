import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  updateDoc,
  getDoc,
} from "@react-native-firebase/firestore";
import { Platform, Alert } from "react-native";
import { getAuth } from "@react-native-firebase/auth";
import { router } from "expo-router";

const db = getFirestore();

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true, // Enable badge updates
  }),
});

export interface NotificationData {
  type: "campaign" | "announcement" | "webinar";
  id: string;
  title: string;
  body: string;
}

class NotificationService {
  private expoPushToken: string | null = null;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;

  // Initialize notification service
  async initialize() {
    // Prevent multiple simultaneous initializations
    if (this.isInitialized || this.isInitializing) {
      console.log("Notification service already initialized or initializing");
      return;
    }

    this.isInitializing = true;

    try {
      console.log("Starting notification service initialization...");

      // Request permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.log("Permissions not granted, skipping token registration");
        this.isInitializing = false;
        return;
      }

      // Get Expo push token
      await this.getExpoPushToken();

      // Store token in user document if we have one
      if (this.expoPushToken) {
        await this.updateUserToken();
      }

      // Set up listeners (only once)
      this.setupNotificationListeners();

      this.isInitialized = true;
      console.log("Notification service initialized successfully");
    } catch (error) {
      console.error("Error initializing notification service:", error);
    } finally {
      this.isInitializing = false;
    }
  }

  // Request notification permissions
  async requestPermissions() {
    try {
      if (!Device.isDevice) {
        console.log("Notifications can only work on physical devices");
        return false;
      }

      // Request Expo notification permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert(
          "Notification Permission",
          "Please enable notifications to receive updates about new campaigns and announcements.",
          [{ text: "OK" }]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  }

  // Get Expo push token
  async getExpoPushToken() {
    try {
      if (!Device.isDevice) {
        console.log("Must use physical device for Expo push notifications");
        return;
      }

      const token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        })
      ).data;

      this.expoPushToken = token;
      console.log("Expo push token:", token);
      return token;
    } catch (error) {
      console.error("Error getting Expo push token:", error);
      return null;
    }
  }

  // Update user token in Firestore
  async updateUserToken() {
    try {
      const user = getAuth().currentUser;
      if (!user || !this.expoPushToken) {
        console.log("No authenticated user or token, skipping update");
        return;
      }

      console.log("Checking if token needs update for user:", user.uid);

      // Get current user document to check existing token
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      let currentToken = null;
      if (userDoc.exists()) {
        const userData = userDoc.data();
        currentToken = userData?.expoPushToken;
      }

      // Only update if token is different
      if (currentToken !== this.expoPushToken) {
        console.log("Token changed, updating user document");
        await updateDoc(userDocRef, {
          expoPushToken: this.expoPushToken,
          lastTokenUpdate: new Date(),
        });
        console.log("User token updated successfully");
      } else {
        console.log("Token unchanged, skipping update");
      }
    } catch (error) {
      console.error("Error updating user token:", error);
    }
  }

  // Setup Expo notification listeners
  setupNotificationListeners() {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received in foreground:", notification);
    });

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response?.notification?.request?.content?.data;
        console.log("Expo notification tapped with data:", data);
        this.handleNotificationTap(data);
      } catch (error) {
        console.error("Error handling Expo notification tap:", error);
        this.handleNotificationTap(null);
      }
    });
  }

  // Handle notification tap - navigate to appropriate screen
  handleNotificationTap(data: any) {
    console.log("Handling notification tap with data:", data);

    try {
      // Check if data exists and has the expected structure
      if (!data) {
        console.log(
          "No data provided for notification tap, navigating to home"
        );
        router.push("/(user-tabs)/home" as any);
        return;
      }

      // Ensure data.type exists
      const notificationType = data.type;
      if (!notificationType) {
        console.log("No notification type found, navigating to home");
        router.push("/(user-tabs)/home" as any);
        return;
      }

      // Navigate based on notification type
      if (notificationType === "campaign") {
        // For campaigns, navigate to campaign details or list
        router.push("/(user-tabs)/campaign" as any);
      } else if (notificationType === "announcement") {
        // For announcements, navigate to home page where announcements are shown
        router.push("/(user-tabs)/home" as any);
      } else if (notificationType === "webinar") {
        // For webinars, navigate to home page where webinars are shown
        router.push("/(user-tabs)/home" as any);
      } else {
        // Default navigation for unknown types
        console.log(
          `Unknown notification type: ${notificationType}, navigating to home`
        );
        router.push("/(user-tabs)/home" as any);
      }
    } catch (error) {
      console.error("Error navigating from notification:", error);
      // Fallback navigation on error
      try {
        router.push("/(user-tabs)/home" as any);
      } catch (fallbackError) {
        console.error("Error with fallback navigation:", fallbackError);
      }
    }
  }

  // DEPRECATED: This function has been removed to prevent duplicate notifications
  // Notifications are now handled exclusively by Cloud Functions:
  // - Campaign notifications: sendCampaignNotifications
  // - Announcement notifications: sendAnnouncementNotifications
  // - Webinar notifications: scheduleWebinarReminders + sendWebinarReminders
  // - @everyone notifications: sendEveryoneNotifications
  async sendNotificationToAllUsers(notificationData: NotificationData) {
    console.warn(
      "sendNotificationToAllUsers is deprecated - notifications are handled by Cloud Functions"
    );
    console.log("Notification would have been sent:", notificationData);
    // Function intentionally left empty to prevent duplicate notifications
  }

  // DEPRECATED: This function has been removed to prevent duplicate notifications
  // Notifications are now handled exclusively by Cloud Functions
  async sendExpoPushNotifications(tokens: string[], content: any) {
    console.warn(
      "sendExpoPushNotifications is deprecated - notifications are handled by Cloud Functions"
    );
    console.log("Would have sent to tokens:", tokens, "with content:", content);
    // Function intentionally left empty to prevent duplicate notifications
  }

  // DEPRECATED: This function is no longer used as notifications are handled by Cloud Functions
  getNotificationTitle(type: string): string {
    console.warn(
      "getNotificationTitle is deprecated - notifications are handled by Cloud Functions"
    );
    switch (type) {
      case "campaign":
        return "🚀 New Campaign Available!";
      case "announcement":
        return "📢 New Announcement";
      case "webinar":
        return "🎓 Upcoming Webinar";
      default:
        return "Campus Creator Club";
    }
  }

  // Reset initialization state (for debugging)
  resetInitialization() {
    console.log("Resetting notification service initialization state");
    this.isInitialized = false;
    this.isInitializing = false;
  }

  // Get current initialization status
  getInitializationStatus() {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      hasExpoToken: !!this.expoPushToken,
    };
  }

  // Update app badge count
  async setBadgeCount(count: number) {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log(`Badge count updated to: ${count}`);
    } catch (error) {
      console.error("Error setting badge count:", error);
    }
  }

  // Clear app badge
  async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
      console.log("Badge cleared");
    } catch (error) {
      console.error("Error clearing badge:", error);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
