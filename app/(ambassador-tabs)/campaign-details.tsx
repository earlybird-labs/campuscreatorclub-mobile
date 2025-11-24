import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import React, { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  arrayRemove,
  arrayUnion,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "@react-native-firebase/firestore";
import CalenderSvg from "@/assets/svgs/CalenderIcon";
import DollarSvg from "@/assets/svgs/DollarIcon";

// Notification service function
const sendPushNotification = async (
  expoPushToken: string,
  title: string,
  body: string
) => {
  const message = {
    to: expoPushToken,
    sound: "default",
    title: title,
    body: body,
    data: {
      type: "campaign_approval",
      timestamp: new Date().toISOString(),
    },
  };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error("Failed to send push notification:", response.status);
    } else {
      console.log("Push notification sent successfully");
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

interface Campaign {
  id: string;
  title: string;
  date: any;
  type: string;
  paymentType?: string;
  amount?: string;
  reward?: string; // Keep for backward compatibility
  requiredViews?: string; // Keep for backward compatibility
  content: string;
  link: string;
  photoUrl?: string;
  createdAt: any;
  applied?: string[];
  approved?: string[];
  rejected?: string[];
  status?: "active" | "completed";
  completedAt?: any;
  applicantCap?: number; // Maximum number of applicants allowed
}

interface User {
  id: string;
  name: string;
  email: string;
  university: string;
  instagram?: string;
  tiktok?: string;
  photoUrl?: string;
}

interface Applicant extends User {
  status: "pending" | "approved" | "rejected";
}

const details = () => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingApplicant, setProcessingApplicant] = useState<string | null>(
    null
  );
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingBulkNotification, setSendingBulkNotification] = useState(false);
  const [sendingNotificationTo, setSendingNotificationTo] = useState<
    string | null
  >(null);
  const [showCustomNotificationModal, setShowCustomNotificationModal] =
    useState(false);
  const [customNotificationTitle, setCustomNotificationTitle] = useState("");
  const [customNotificationMessage, setCustomNotificationMessage] =
    useState("");
  const [sendingCustomNotification, setSendingCustomNotification] =
    useState(false);
  const [assignedCampaignId, setAssignedCampaignId] = useState<string | null>(
    null
  );
  // Ambassador modal states
  const [ambassadorModalVisible, setAmbassadorModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [assigningAmbassador, setAssigningAmbassador] = useState(false);
  // Applicant cap modal states
  const [capModalVisible, setCapModalVisible] = useState(false);
  const [newCapValue, setNewCapValue] = useState("");
  const [updatingCap, setUpdatingCap] = useState(false);

  const db = getFirestore();

  // Get ambassador's assigned campaign ID
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(getAuth(), async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData?.isAmbassador && userData?.assignedCampaignId) {
              setAssignedCampaignId(userData.assignedCampaignId);
            } else {
              Alert.alert("Error", "No assigned campaign found");
              router.back();
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          Alert.alert("Error", "Failed to load user data");
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Fetch campaign details and applicants in real-time
  useEffect(() => {
    if (!assignedCampaignId) return;

    const campaignRef = doc(db, "campaigns", assignedCampaignId);

    const unsubscribe = onSnapshot(campaignRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const campaignData = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as Campaign;

        setCampaign(campaignData);

        // Fetch applicant details
        await fetchApplicantDetails(campaignData);
      } else {
        Alert.alert("Error", "Campaign not found");
        router.back();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [assignedCampaignId]);

  const fetchApplicantDetails = async (campaignData: Campaign) => {
    const applicantDetails: Applicant[] = [];

    // Get all unique user IDs from applied, approved, and rejected arrays
    const appliedUsers = campaignData.applied || [];
    const approvedUsers = campaignData.approved || [];
    const rejectedUsers = campaignData.rejected || [];

    const allUserIds = [
      ...new Set([...appliedUsers, ...approvedUsers, ...rejectedUsers]),
    ];

    // Fetch all user details in parallel for better performance
    const userPromises = allUserIds.map(async (userId) => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const userData = userDoc.data() as Omit<User, "id">;

          let status: "pending" | "approved" | "rejected" = "pending";
          if (approvedUsers.includes(userId)) {
            status = "approved";
          } else if (rejectedUsers.includes(userId)) {
            status = "rejected";
          }

          return {
            id: userId,
            ...userData,
            status,
          } as Applicant;
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      }
      return null;
    });

    // Wait for all user data to be fetched in parallel
    const results = await Promise.all(userPromises);
    const validResults = results.filter(
      (result): result is Applicant => result !== null
    );

    setApplicants(validResults);
  };

  // Search users by email for ambassador assignment
  const searchUsersByEmail = async (email: string) => {
    if (!email.trim()) {
      setSearchedUsers([]);
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("email", ">=", email.toLowerCase()),
        where("email", "<=", email.toLowerCase() + "\uf8ff")
      );

      const snapshot = await getDocs(q);
      const users: User[] = [];

      snapshot.forEach((doc) => {
        const userData = doc.data();
        users.push({
          id: doc.id,
          name: userData.name,
          email: userData.email,
          photoUrl: userData.photoUrl,
          university: userData.university,
          instagram: userData.instagram,
          tiktok: userData.tiktok,
        });
      });

      setSearchedUsers(users);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchedUsers([]);
    }
  };

  // Assign ambassador to the current campaign
  const assignAmbassador = async () => {
    if (!selectedUser || !assignedCampaignId) {
      Alert.alert("Error", "Please select a user to assign as ambassador.");
      return;
    }

    setAssigningAmbassador(true);
    try {
      // Update user document to add ambassador flag and campaign assignment
      const userRef = doc(db, "users", selectedUser.id);
      await updateDoc(userRef, {
        isAmbassador: true,
        assignedCampaignId: assignedCampaignId,
        assignedCampaignChatId: assignedCampaignId, // Using campaign ID as chat ID
        ambassadorAssignedAt: new Date(),
      });

      Alert.alert(
        "Success",
        `${selectedUser.name} has been assigned as ambassador for this campaign!`
      );

      // Reset modal state
      setAmbassadorModalVisible(false);
      setSelectedUser(null);
      setUserSearchQuery("");
      setSearchedUsers([]);
    } catch (error) {
      console.error("Error assigning ambassador:", error);
      Alert.alert("Error", "Failed to assign ambassador. Please try again.");
    } finally {
      setAssigningAmbassador(false);
    }
  };

  // Update campaign applicant cap
  const updateCampaignCap = async () => {
    if (!assignedCampaignId || !newCapValue.trim()) {
      Alert.alert("Error", "Please enter a valid cap number.");
      return;
    }

    const capNumber = parseInt(newCapValue);
    if (isNaN(capNumber) || capNumber < 0) {
      Alert.alert("Error", "Please enter a valid positive number.");
      return;
    }

    setUpdatingCap(true);
    try {
      const campaignRef = doc(db, "campaigns", assignedCampaignId);
      await updateDoc(campaignRef, {
        applicantCap: capNumber,
        updatedAt: new Date(),
      });

      Alert.alert(
        "Success",
        capNumber === 0
          ? "Applicant cap removed successfully!"
          : `Applicant cap set to ${capNumber} successfully!`
      );

      // Reset modal state
      setCapModalVisible(false);
      setNewCapValue("");
    } catch (error) {
      console.error("Error updating applicant cap:", error);
      Alert.alert("Error", "Failed to update applicant cap. Please try again.");
    } finally {
      setUpdatingCap(false);
    }
  };

  const handleApproveApplicant = async (userId: string) => {
    if (!campaign) return;

    setProcessingApplicant(userId);
    try {
      const campaignRef = doc(db, "campaigns", campaign.id);

      // Get user data for notification (do this in parallel with Firestore update)
      const [userDoc] = await Promise.all([
        getDoc(doc(db, "users", userId)),
        // Update campaign status
        updateDoc(campaignRef, {
          applied: arrayRemove(userId),
          rejected: arrayRemove(userId),
          approved: arrayUnion(userId),
        }),
      ]);

      // Send push notification in background (don't block UI)
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const expoPushToken = userData?.expoPushToken;

        if (expoPushToken) {
          // Send notification asynchronously without waiting
          sendPushNotification(
            expoPushToken,
            "🎉 Campaign Approved!",
            `Congratulations! You've been approved for the "${campaign.title}" campaign.`
          ).catch((notificationError) => {
            console.error("Error sending notification:", notificationError);
          });
        }
      }

      Alert.alert("Success", "Applicant approved successfully!");
    } catch (error) {
      console.error("Error approving applicant:", error);
      Alert.alert("Error", "Failed to approve applicant. Please try again.");
    } finally {
      setProcessingApplicant(null);
    }
  };

  const handleRejectApplicant = async (userId: string) => {
    if (!campaign) return;

    setProcessingApplicant(userId);
    try {
      const campaignRef = doc(db, "campaigns", campaign.id);

      // Single atomic update operation
      await updateDoc(campaignRef, {
        applied: arrayRemove(userId),
        approved: arrayRemove(userId),
        rejected: arrayUnion(userId),
      });

      Alert.alert("Success", "Applicant rejected successfully!");
    } catch (error) {
      console.error("Error rejecting applicant:", error);
      Alert.alert("Error", "Failed to reject applicant. Please try again.");
    } finally {
      setProcessingApplicant(null);
    }
  };

  // Send content reminder to all approved users
  const sendContentReminderToAll = async () => {
    if (!campaign) return;

    const approvedUsers = applicants.filter(
      (user) => user.status === "approved"
    );

    if (approvedUsers.length === 0) {
      Alert.alert(
        "No Approved Users",
        "There are no approved users to send notifications to."
      );
      return;
    }

    Alert.alert(
      "Send Content Reminder",
      `Just a quick reminder to all approved participants to create their content for the "${campaign?.title}" campaign!`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            setSendingBulkNotification(true);
            let successCount = 0;
            let failureCount = 0;

            try {
              // Get all approved users with push tokens
              const notificationPromises = approvedUsers.map(async (user) => {
                try {
                  const userDoc = await getDoc(doc(db, "users", user.id));
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const expoPushToken = userData?.expoPushToken;

                    if (expoPushToken) {
                      await sendPushNotification(
                        expoPushToken,
                        "📅 Content Reminder",
                        `Don't forget to create your content for the "${campaign.title}" campaign!`
                      );
                      successCount++;
                    } else {
                      failureCount++;
                    }
                  } else {
                    failureCount++;
                  }
                } catch (error) {
                  console.error(
                    `Error sending notification to user ${user.id}:`,
                    error
                  );
                  failureCount++;
                }
              });

              await Promise.all(notificationPromises);

              Alert.alert(
                "Notifications Sent",
                `Successfully sent ${successCount} notifications.${
                  failureCount > 0 ? ` ${failureCount} failed.` : ""
                }`
              );
            } catch (error) {
              console.error("Error sending bulk notifications:", error);
              Alert.alert(
                "Error",
                "Failed to send notifications. Please try again."
              );
            } finally {
              setSendingBulkNotification(false);
            }
          },
        },
      ]
    );
  };

  // Send custom notification to all approved users
  const sendCustomNotificationToApproved = async () => {
    if (!campaign) return;

    if (!customNotificationTitle.trim() || !customNotificationMessage.trim()) {
      Alert.alert(
        "Error",
        "Please enter both title and message for the notification."
      );
      return;
    }

    const approvedUsers = applicants.filter(
      (user) => user.status === "approved"
    );

    if (approvedUsers.length === 0) {
      Alert.alert(
        "No Approved Users",
        "There are no approved users to send notifications to."
      );
      return;
    }

    setSendingCustomNotification(true);

    try {
      // Get all approved users with push tokens
      const notificationPromises = approvedUsers.map(async (user) => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const expoPushToken = userData?.expoPushToken;

            if (expoPushToken) {
              await sendPushNotification(
                expoPushToken,
                customNotificationTitle,
                customNotificationMessage
              );
            }
          }
        } catch (error) {
          console.error(
            `Error sending notification to user ${user.id}:`,
            error
          );
        }
      });

      await Promise.all(notificationPromises);

      Alert.alert(
        "Success",
        `Custom notification sent to ${
          approvedUsers.length
        } approved participant${approvedUsers.length > 1 ? "s" : ""}!`
      );

      // Reset form and close modal
      setCustomNotificationTitle("");
      setCustomNotificationMessage("");
      setShowCustomNotificationModal(false);
    } catch (error) {
      console.error("Error sending custom notifications:", error);
      Alert.alert("Error", "Failed to send notifications. Please try again.");
    } finally {
      setSendingCustomNotification(false);
    }
  };

  // Send individual content reminder
  const sendIndividualReminder = async (userId: string, userName: string) => {
    setSendingNotificationTo(userId);

    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const expoPushToken = userData?.expoPushToken;

        if (expoPushToken) {
          await sendPushNotification(
            expoPushToken,
            "📅 Content Reminder",
            `Hi ${userName}! Don't forget to create your content for the "${campaign?.title}" campaign.`
          );
          Alert.alert("Success", `Reminder sent to ${userName}!`);
        } else {
          Alert.alert(
            "Error",
            `${userName} doesn't have notifications enabled.`
          );
        }
      } else {
        Alert.alert("Error", "User not found.");
      }
    } catch (error) {
      console.error("Error sending individual notification:", error);
      Alert.alert("Error", "Failed to send reminder. Please try again.");
    } finally {
      setSendingNotificationTo(null);
    }
  };

  const openLink = (url: string) => {
    if (url) {
      Linking.openURL(url.startsWith("http") ? url : `https://${url}`);
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!campaign) return;

    Alert.alert(
      "Mark as Completed",
      "Mark this campaign as completed? This will move it to the completed campaigns list.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Complete",
          onPress: async () => {
            try {
              const campaignRef = doc(db, "campaigns", campaign.id);
              await updateDoc(campaignRef, {
                status: "completed",
                completedAt: new Date(),
                updatedAt: new Date(),
              });
              Alert.alert("Success", "Campaign marked as completed!", [
                {
                  text: "OK",
                  onPress: () => router.back(),
                },
              ]);
            } catch (error) {
              console.error("Error updating campaign:", error);
              Alert.alert(
                "Error",
                "Failed to update campaign. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const formatNumber = (num: string | number) => {
    const numValue = typeof num === "string" ? parseInt(num) : num;
    if (isNaN(numValue)) return num;

    if (numValue >= 1000000000) {
      return (numValue / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
    }
    if (numValue >= 1000000) {
      return (numValue / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (numValue >= 1000) {
      return (numValue / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return numValue.toString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const renderApplicant = ({ item }: { item: Applicant }) => (
    <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100">
      <View className="flex-row items-center mb-3">
        <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
          <Text className="font-gBold text-lg text-blue-600">
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View className="flex-1">
          <Text className="font-gBold text-lg text-gray-900">{item.name}</Text>
          <Text className="text-gray-600 text-sm">{item.university}</Text>
          <Text className="text-gray-500 text-xs">{item.email}</Text>
        </View>

        <View
          className={`px-3 py-1 rounded-full ${getStatusColor(item.status)}`}
        >
          <Text className="text-xs font-gMedium capitalize">{item.status}</Text>
        </View>
      </View>

      {/* Social Media Links */}
      {(item.instagram || item.tiktok) && (
        <View className="flex-row items-center mb-3 gap-x-4">
          {item.instagram && (
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() =>
                openLink(
                  `https://instagram.com/${item.instagram?.replace("@", "")}`
                )
              }
            >
              <Image
                source={require("@/assets/icons/instagram.png")}
                style={{ width: 16, height: 16, marginRight: 4 }}
              />
              <Text className="text-gray-600 text-sm">{item.instagram}</Text>
            </TouchableOpacity>
          )}

          {item.tiktok && (
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() =>
                openLink(`https://tiktok.com/@${item.tiktok?.replace("@", "")}`)
              }
            >
              <Image
                source={require("@/assets/icons/tiktok.png")}
                style={{ width: 16, height: 16, marginRight: 4 }}
              />
              <Text className="text-gray-600 text-sm">{item.tiktok}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Action Buttons */}
      {item.status === "pending" && (
        <View className="flex-row gap-x-3">
          <TouchableOpacity
            className="flex-1 bg-green-500 rounded-xl py-3 items-center"
            onPress={() => handleApproveApplicant(item.id)}
            disabled={processingApplicant === item.id}
          >
            {processingApplicant === item.id ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text className="text-white font-gBold">Approve</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-red-500 rounded-xl py-3 items-center"
            onPress={() => handleRejectApplicant(item.id)}
            disabled={processingApplicant === item.id}
          >
            {processingApplicant === item.id ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text className="text-white font-gBold">Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {item.status === "approved" && (
        <View>
          <View className="flex-row gap-x-3 mb-2">
            {/* Individual Reminder Button */}
            <TouchableOpacity
              className="w-12 h-12 bg-orange-100 rounded-xl items-center justify-center"
              onPress={() => sendIndividualReminder(item.id, item.name)}
              disabled={sendingNotificationTo === item.id}
            >
              {sendingNotificationTo === item.id ? (
                <ActivityIndicator color="#EA580C" size="small" />
              ) : (
                <Ionicons name="notifications" size={20} color="#EA580C" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-red-100 rounded-xl py-3 items-center"
              onPress={() => handleRejectApplicant(item.id)}
              disabled={processingApplicant === item.id}
            >
              <Text className="text-red-600 font-gBold">Move to Rejected</Text>
            </TouchableOpacity>
          </View>

          {/* Bell button explanation */}
          <View className="flex-row items-center">
            <View className="w-12 flex-row justify-center">
              <View className="w-1 h-1 bg-orange-400 rounded-full"></View>
            </View>
            <Text className="text-orange-600 text-xs font-gMedium ml-3">
              Tap 🔔 to send content reminder
            </Text>
          </View>
        </View>
      )}

      {item.status === "rejected" && (
        <TouchableOpacity
          className="bg-green-100 rounded-xl py-3 items-center"
          onPress={() => handleApproveApplicant(item.id)}
          disabled={processingApplicant === item.id}
        >
          <Text className="text-green-600 font-gBold">Move to Approved</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const filteredApplicants = (() => {
    let filtered =
      selectedFilter === "all"
        ? applicants
        : applicants.filter((a) => a.status === selectedFilter);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (applicant) =>
          applicant.name.toLowerCase().includes(query) ||
          applicant.email.toLowerCase().includes(query) ||
          applicant.university.toLowerCase().includes(query) ||
          applicant.instagram?.toLowerCase().includes(query) ||
          applicant.tiktok?.toLowerCase().includes(query)
      );
    }

    return filtered;
  })();

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-600">
            Loading campaign details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!campaign) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-600">Campaign not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pendingCount = applicants.filter((a) => a.status === "pending").length;
  const approvedCount = applicants.filter(
    (a) => a.status === "approved"
  ).length;
  const rejectedCount = applicants.filter(
    (a) => a.status === "rejected"
  ).length;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
            <Text className="font-gBold text-xl text-gray-900">
              Campaign Details
            </Text>
            <TouchableOpacity
              onPress={() => setAmbassadorModalVisible(true)}
              className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center"
            >
              <Ionicons name="person-add" size={20} color="#8B5CF6" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Campaign Info */}
            <View className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 m-2 rounded-3xl">
              {/* Action Buttons Section */}
              <View className="mb-4">
                <View className="flex-row justify-between gap-3">
                  {/* Content Reminder Button */}
                  <TouchableOpacity
                    onPress={sendContentReminderToAll}
                    disabled={sendingBulkNotification || approvedCount === 0}
                    className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-xl ${
                      approvedCount === 0 ? "bg-gray-200" : "bg-orange-100"
                    }`}
                  >
                    {sendingBulkNotification ? (
                      <ActivityIndicator size="small" color="#EA580C" />
                    ) : (
                      <Ionicons
                        name="notifications"
                        size={18}
                        color={approvedCount === 0 ? "#9CA3AF" : "#EA580C"}
                      />
                    )}
                    <Text
                      className={`ml-2 font-gMedium text-sm ${
                        approvedCount === 0
                          ? "text-gray-500"
                          : "text-orange-700"
                      }`}
                    >
                      {sendingBulkNotification
                        ? "Sending..."
                        : "Quick Reminder"}
                    </Text>
                  </TouchableOpacity>

                  {/* Custom Notification Button */}
                  <TouchableOpacity
                    onPress={() => setShowCustomNotificationModal(true)}
                    disabled={approvedCount === 0}
                    className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-xl ${
                      approvedCount === 0 ? "bg-gray-200" : "bg-blue-100"
                    }`}
                  >
                    <Ionicons
                      name="mail"
                      size={18}
                      color={approvedCount === 0 ? "#9CA3AF" : "#3B82F6"}
                    />
                    <Text
                      className={`ml-2 font-gMedium text-sm ${
                        approvedCount === 0 ? "text-gray-500" : "text-blue-700"
                      }`}
                    >
                      Custom Notification
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row justify-between gap-3 mt-3">
                  {/* Mark as Completed Button */}
                  {(!campaign?.status || campaign?.status === "active") && (
                    <TouchableOpacity
                      onPress={handleMarkAsCompleted}
                      className="flex-1 flex-row items-center justify-center py-3 px-4 rounded-xl bg-green-100"
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#059669"
                      />
                      <Text className="ml-2 font-gMedium text-sm text-green-700">
                        Mark Complete
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Campaign Chat Button */}
                  <TouchableOpacity
                    onPress={() =>
                      router.push("/(ambassador-tabs)/campaign-chat" as any)
                    }
                    className={`${
                      !campaign?.status || campaign?.status === "active"
                        ? "flex-1"
                        : "flex-1"
                    } flex-row items-center justify-center py-3 px-4 rounded-xl bg-purple-100`}
                  >
                    <Ionicons name="chatbubbles" size={18} color="#8B5CF6" />
                    <Text className="ml-2 font-gMedium text-sm text-purple-700">
                      Campaign Chat
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row items-start mb-4">
                <View className="w-20 h-20 bg-white rounded-2xl items-center justify-center mr-4 overflow-hidden">
                  {campaign.photoUrl ? (
                    <Image
                      source={{ uri: campaign.photoUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  ) : (
                    <Text className="font-gBold text-2xl text-gray-900">
                      {campaign.title.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View className="flex-1">
                  <Text className="font-gBold text-2xl text-gray-900 mb-2">
                    {campaign.title}
                  </Text>
                  {campaign.status === "completed" && (
                    <View className="mb-2">
                      <View className="bg-green-500 rounded-full px-3 py-1 self-start">
                        <Text className="text-white text-xs font-gBold">
                          ✓ COMPLETED
                        </Text>
                      </View>
                    </View>
                  )}
                  <Text className="text-gray-600 text-base mb-3">
                    {campaign.type}
                    {campaign.status === "completed" &&
                      campaign.completedAt && (
                        <Text className="text-gray-500 text-sm">
                          {" • Completed on "}
                          {campaign.completedAt.toDate().toLocaleDateString()}
                        </Text>
                      )}
                  </Text>

                  <View className="flex-row items-center gap-x-3">
                    <View className="flex-row items-center bg-blue-100 rounded-full py-2 px-3 mr-2">
                      <CalenderSvg />
                      <Text className="ml-1.5 font-gMedium text-blue-600 text-[14px]">
                        {campaign.date.toDate().toLocaleDateString()}
                      </Text>
                    </View>

                    <View
                      className={`flex-row items-center rounded-full py-2 px-3 ${
                        campaign.paymentType === "Gifted"
                          ? "bg-emerald-100"
                          : "bg-orange-100"
                      }`}
                    >
                      {campaign.paymentType === "Gifted" ? (
                        <Ionicons name="gift" size={16} color="#059669" />
                      ) : (
                        <DollarSvg />
                      )}
                      <Text
                        className={`ml-1.5 font-gMedium text-[14px] ${
                          campaign.paymentType === "Gifted"
                            ? "text-emerald-600"
                            : "text-orange-700"
                        }`}
                      >
                        {campaign.paymentType === "Paid"
                          ? campaign.amount || "$0"
                          : campaign.paymentType === "Gifted"
                          ? "Gifted"
                          : `$${formatNumber(
                              campaign.reward || "0"
                            )} / ${formatNumber(
                              campaign.requiredViews || "0"
                            )}`}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Campaign Details */}
              <View className="bg-white/60 rounded-2xl p-4 mb-4">
                <Text className="font-gBold text-gray-900 text-lg mb-2">
                  Campaign Description
                </Text>
                <Text className="text-gray-700 text-base leading-6 mb-3">
                  {campaign.content}
                </Text>
              </View>

              {/* Campaign Link */}
              {campaign.link && (
                <TouchableOpacity
                  className="bg-blue-500 rounded-2xl py-3 px-4 flex-row items-center justify-center"
                  onPress={() => openLink(campaign.link)}
                >
                  <Ionicons name="link-outline" size={20} color="white" />
                  <Text className="text-white font-gBold ml-2">
                    View Campaign Link
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Applicant Cap Section */}
            <View className="px-4 mb-4">
              <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-lg font-semibold text-gray-900">
                    Application Cap
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setNewCapValue(campaign?.applicantCap?.toString() || "");
                      setCapModalVisible(true);
                    }}
                    className="bg-purple-100 px-3 py-2 rounded-lg"
                  >
                    <Text className="text-purple-700 text-sm font-medium">
                      {campaign?.applicantCap ? "Edit Cap" : "Set Cap"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {campaign?.applicantCap ? (
                  <View className="p-3 bg-purple-50 rounded-lg">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-purple-700 font-medium">
                        Applications: {applicants.length}/
                        {campaign.applicantCap}
                      </Text>
                      <View
                        className={`px-3 py-1 rounded-full ${
                          applicants.length >= campaign.applicantCap
                            ? "bg-red-100"
                            : "bg-green-100"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            applicants.length >= campaign.applicantCap
                              ? "text-red-700"
                              : "text-green-700"
                          }`}
                        >
                          {applicants.length >= campaign.applicantCap
                            ? "FULL"
                            : "OPEN"}
                        </Text>
                      </View>
                    </View>
                    {applicants.length >= campaign.applicantCap && (
                      <Text className="text-red-600 text-sm mt-2">
                        ⚠️ Campaign has reached maximum applicants
                      </Text>
                    )}
                  </View>
                ) : (
                  <View className="p-3 bg-gray-50 rounded-lg">
                    <Text className="text-gray-600 text-center">
                      No applicant cap set • Unlimited applications allowed
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Statistics */}
            <View className="flex-row justify-between px-4 mb-6">
              <TouchableOpacity
                className={`rounded-2xl p-4 flex-1 mr-2 ${
                  selectedFilter === "pending"
                    ? "bg-yellow-200 border-2 border-yellow-400"
                    : "bg-yellow-50"
                }`}
                onPress={() =>
                  setSelectedFilter(
                    selectedFilter === "pending" ? "all" : "pending"
                  )
                }
              >
                <Text className="text-yellow-700 font-gBold text-2xl">
                  {pendingCount}
                </Text>
                <Text className="text-yellow-700 font-gMedium">Pending</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`rounded-2xl p-4 flex-1 mx-1 ${
                  selectedFilter === "approved"
                    ? "bg-green-200 border-2 border-green-400"
                    : "bg-green-50"
                }`}
                onPress={() =>
                  setSelectedFilter(
                    selectedFilter === "approved" ? "all" : "approved"
                  )
                }
              >
                <Text className="text-green-600 font-gBold text-2xl">
                  {approvedCount}
                </Text>
                <Text className="text-green-700 font-gMedium">Approved</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`rounded-2xl p-4 flex-1 ml-2 ${
                  selectedFilter === "rejected"
                    ? "bg-red-200 border-2 border-red-400"
                    : "bg-red-50"
                }`}
                onPress={() =>
                  setSelectedFilter(
                    selectedFilter === "rejected" ? "all" : "rejected"
                  )
                }
              >
                <Text className="text-red-600 font-gBold text-2xl">
                  {rejectedCount}
                </Text>
                <Text className="text-red-700 font-gMedium">Rejected</Text>
              </TouchableOpacity>
            </View>

            {/* Applicants List */}
            <View className="px-4 pb-8">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-gBold text-xl text-gray-900">
                  {selectedFilter === "all"
                    ? `Applicants (${applicants.length})`
                    : `${
                        selectedFilter.charAt(0).toUpperCase() +
                        selectedFilter.slice(1)
                      } Applicants (${
                        applicants.filter((a) => a.status === selectedFilter)
                          .length
                      })`}
                </Text>
                {selectedFilter !== "all" && (
                  <TouchableOpacity
                    onPress={() => setSelectedFilter("all")}
                    className="bg-gray-100 rounded-xl px-3 py-2"
                  >
                    <Text className="text-gray-600 font-gMedium text-sm">
                      Show All
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Bar */}
              <View className="mb-4">
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                  <Ionicons name="search" size={20} color="#6B7280" />
                  <TextInput
                    className="flex-1 ml-2 text-gray-900 font-gMedium text-base"
                    placeholder="Search by name, email, university, or social media..."
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {(() => {
                if (filteredApplicants.length === 0) {
                  return (
                    <View className="bg-gray-50 rounded-2xl p-8 items-center">
                      <Ionicons
                        name="people-outline"
                        size={48}
                        color="#9CA3AF"
                      />
                      <Text className="text-gray-500 text-lg font-gMedium mt-4">
                        {searchQuery
                          ? "No matching applicants found"
                          : selectedFilter === "all"
                          ? "No applicants yet"
                          : `No ${selectedFilter} applicants`}
                      </Text>
                      <Text className="text-gray-400 text-center mt-2">
                        {searchQuery
                          ? "Try adjusting your search terms"
                          : selectedFilter === "all"
                          ? "Applications will appear here as users apply to this campaign"
                          : `No applicants have been ${selectedFilter} for this campaign yet`}
                      </Text>
                    </View>
                  );
                }

                return (
                  <FlatList
                    data={filteredApplicants}
                    renderItem={renderApplicant}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                );
              })()}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Custom Notification Modal */}
      <Modal
        visible={showCustomNotificationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomNotificationModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-black/50 justify-center items-center px-5">
            <View className="bg-white rounded-2xl p-6 w-full max-w-md">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-gBold text-gray-900">
                  Send Custom Notification
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCustomNotificationModal(false)}
                  className="p-1"
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View className="bg-blue-50 rounded-xl p-3 mb-4">
                <View className="flex-row items-center">
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color="#3B82F6"
                  />
                  <Text className="ml-2 text-blue-700 text-sm">
                    This will send a notification to all {approvedCount}{" "}
                    approved campaign participants.
                  </Text>
                </View>
              </View>

              {/* Title Input */}
              <View className="mb-4">
                <Text className="text-gray-700 font-gMedium mb-2">
                  Notification Title
                </Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                  placeholder="Enter notification title..."
                  value={customNotificationTitle}
                  onChangeText={setCustomNotificationTitle}
                  maxLength={50}
                  placeholderTextColor="#9CA3AF"
                />
                <Text className="text-gray-500 text-xs mt-1 text-right">
                  {customNotificationTitle.length}/50
                </Text>
              </View>

              {/* Message Input */}
              <View className="mb-6">
                <Text className="text-gray-700 font-gMedium mb-2">Message</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 min-h-[100px]"
                  placeholder="Enter your custom message..."
                  value={customNotificationMessage}
                  onChangeText={setCustomNotificationMessage}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={200}
                  placeholderTextColor="#9CA3AF"
                />
                <Text className="text-gray-500 text-xs mt-1 text-right">
                  {customNotificationMessage.length}/200
                </Text>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setShowCustomNotificationModal(false)}
                  className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                >
                  <Text className="text-gray-700 font-gMedium">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={sendCustomNotificationToApproved}
                  disabled={
                    sendingCustomNotification ||
                    !customNotificationTitle.trim() ||
                    !customNotificationMessage.trim()
                  }
                  className={`flex-1 rounded-xl py-3 items-center ${
                    sendingCustomNotification ||
                    !customNotificationTitle.trim() ||
                    !customNotificationMessage.trim()
                      ? "bg-gray-300"
                      : "bg-blue-500"
                  }`}
                >
                  {sendingCustomNotification ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white font-gBold">
                      Send Notification
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Ambassador Assignment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={ambassadorModalVisible}
        onRequestClose={() => setAmbassadorModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl h-4/5">
            <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
              <Text className="text-2xl font-bold text-gray-900">
                Add Ambassador
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setAmbassadorModalVisible(false);
                  setSelectedUser(null);
                  setUserSearchQuery("");
                  setSearchedUsers([]);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 p-6"
              showsVerticalScrollIndicator={false}
            >
              {/* User Search */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-3">
                  Search User
                </Text>
                <View className="relative">
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 pr-12 text-base text-gray-900"
                    placeholder="Enter user email..."
                    value={userSearchQuery}
                    onChangeText={(text) => {
                      setUserSearchQuery(text);
                      searchUsersByEmail(text);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#9CA3AF"
                  />
                  <View className="absolute right-4 top-4">
                    <Ionicons name="search" size={20} color="#9CA3AF" />
                  </View>
                </View>

                {/* Search Results */}
                {searchedUsers.length > 0 && (
                  <View className="mt-3 max-h-48">
                    <ScrollView
                      className="bg-white border border-gray-200 rounded-xl"
                      showsVerticalScrollIndicator={false}
                    >
                      {searchedUsers.map((user) => (
                        <TouchableOpacity
                          key={user.id}
                          onPress={() => {
                            setSelectedUser(user);
                            setUserSearchQuery(user.email);
                            setSearchedUsers([]);
                          }}
                          className={`flex-row items-center p-4 border-b border-gray-100 ${
                            selectedUser?.id === user.id ? "bg-purple-50" : ""
                          }`}
                        >
                          {user.photoUrl ? (
                            <Image
                              source={{ uri: user.photoUrl }}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginRight: 12,
                              }}
                            />
                          ) : (
                            <View className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center mr-3">
                              <Ionicons
                                name="person"
                                size={20}
                                color="#6B7280"
                              />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="font-medium text-gray-900">
                              {user.name}
                            </Text>
                            <Text className="text-sm text-gray-500">
                              {user.email}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Selected User */}
              {selectedUser && (
                <View className="mb-6 p-4 bg-purple-50 rounded-xl">
                  <Text className="text-sm font-medium text-purple-600 mb-2">
                    Selected User:
                  </Text>
                  <View className="flex-row items-center">
                    {selectedUser.photoUrl ? (
                      <Image
                        source={{ uri: selectedUser.photoUrl }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          marginRight: 12,
                        }}
                      />
                    ) : (
                      <View className="w-12 h-12 bg-purple-200 rounded-full items-center justify-center mr-3">
                        <Ionicons name="person" size={20} color="#8B5CF6" />
                      </View>
                    )}
                    <View>
                      <Text className="font-semibold text-purple-900">
                        {selectedUser.name}
                      </Text>
                      <Text className="text-purple-600">
                        {selectedUser.email}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Campaign Info */}
              {campaign && (
                <View className="mb-6 p-4 bg-gray-50 rounded-xl">
                  <Text className="text-sm font-medium text-gray-600 mb-2">
                    Will be assigned to:
                  </Text>
                  <View className="flex-row items-center">
                    {campaign.photoUrl ? (
                      <Image
                        source={{ uri: campaign.photoUrl }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          marginRight: 12,
                        }}
                      />
                    ) : (
                      <View className="w-12 h-12 bg-blue-200 rounded-lg items-center justify-center mr-3">
                        <Ionicons name="megaphone" size={20} color="#3B82F6" />
                      </View>
                    )}
                    <View>
                      <Text className="font-semibold text-gray-900">
                        {campaign.title}
                      </Text>
                      <Text className="text-gray-600">{campaign.type}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Assign Button */}
              <TouchableOpacity
                onPress={assignAmbassador}
                disabled={!selectedUser || assigningAmbassador}
                className={`p-4 rounded-xl items-center ${
                  selectedUser && !assigningAmbassador
                    ? "bg-purple-500"
                    : "bg-gray-300"
                }`}
              >
                {assigningAmbassador ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Assigning...
                    </Text>
                  </View>
                ) : (
                  <Text
                    className={`font-semibold ${
                      selectedUser ? "text-white" : "text-gray-500"
                    }`}
                  >
                    Add Ambassador
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Set Applicant Cap Modal */}
      <Modal
        visible={capModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCapModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-black/50 justify-center items-center px-5">
            <View className="bg-white rounded-2xl p-6 w-full max-w-md">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-gBold text-gray-900">
                  Set Applicant Cap
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setCapModalVisible(false);
                    setNewCapValue("");
                  }}
                  className="p-1"
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View className="bg-purple-50 rounded-xl p-3 mb-4">
                <View className="flex-row items-center">
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color="#8B5CF6"
                  />
                  <Text className="ml-2 text-purple-700 text-sm">
                    Set the maximum number of applicants for this campaign.
                    Enter 0 to remove the cap.
                  </Text>
                </View>
              </View>

              {/* Current Status */}
              <View className="mb-4 p-3 bg-gray-50 rounded-xl">
                <Text className="text-gray-600 text-sm mb-1">
                  Current Status:
                </Text>
                <Text className="text-gray-900 font-medium">
                  {applicants.length} total applicants
                </Text>
                {campaign?.applicantCap && (
                  <Text className="text-purple-600 text-sm">
                    Current cap: {campaign.applicantCap}
                  </Text>
                )}
              </View>

              {/* Number Input */}
              <View className="mb-6">
                <Text className="text-gray-700 font-gMedium mb-2">
                  Applicant Cap
                </Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-lg"
                  placeholder="Enter number (0 = no cap)"
                  value={newCapValue}
                  onChangeText={setNewCapValue}
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
                <Text className="text-gray-500 text-xs mt-1">
                  Tip: Set to 0 to allow unlimited applications
                </Text>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setCapModalVisible(false);
                    setNewCapValue("");
                  }}
                  className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                >
                  <Text className="text-gray-700 font-gMedium">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={updateCampaignCap}
                  disabled={updatingCap || !newCapValue.trim()}
                  className={`flex-1 rounded-xl py-3 items-center ${
                    updatingCap || !newCapValue.trim()
                      ? "bg-gray-300"
                      : "bg-purple-500"
                  }`}
                >
                  {updatingCap ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white font-gBold">
                      {parseInt(newCapValue) === 0 ? "Remove Cap" : "Set Cap"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default details;
