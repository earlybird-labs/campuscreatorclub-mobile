import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinkPreview } from "@flyerhq/react-native-link-preview";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  limit,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { useLocalSearchParams, router } from "expo-router";
import { Linking } from "react-native";

interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  timestamp: any;
  createdAt: any;
  replyTo?: {
    id: string;
    text: string;
    userName: string;
  };
}

const EMOJIS = ["🤖", "😎", "😂", "❤️", "🙌"];

const CampaignChat = () => {
  const { campaignId } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userCache, setUserCache] = useState<Record<string, any>>({});
  const [userCount, setUserCount] = useState(0);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<
    string | null
  >(null);
  const [reactions, setReactions] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const emojiAnim = useRef(new Animated.Value(0)).current;
  const [inputHeight, setInputHeight] = useState(40);
  const [usersListVisible, setUsersListVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<any[]>([]);
  const [approvedUserCount, setApprovedUserCount] = useState(0);
  const [loadingApprovedUsers, setLoadingApprovedUsers] = useState(false);

  // New state for reporting and blocking
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(
    null
  );
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [campaignName, setCampaignName] = useState<string>("Campaign Chat");

  const db = getFirestore();
  const auth = getAuth();

  // Report reasons
  const REPORT_REASONS = [
    "Spam",
    "Harassment",
    "Hate Speech",
    "Inappropriate Content",
    "Bullying",
    "Scam or Fraud",
    "Violence or Threats",
    "Other",
  ];

  // Get current user
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
      // Fetch current user's data including blocked users
      const fetchUserData = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData) {
              setCurrentUserData(userData);
              setBlockedUsers(userData.blockedUsers || []);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };
      fetchUserData();
    }
  }, []);

  // Listen for current user data changes (including blocked users)
  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData) {
          setCurrentUserData(userData);
          setBlockedUsers(userData.blockedUsers || []);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Check if user is approved for this campaign
  useEffect(() => {
    const fetchApproval = async () => {
      console.log("fetching approval");
      const user = auth.currentUser;
      const campaignRef = doc(db, "campaigns", campaignId as string);
      const campaignSnap = await getDoc(campaignRef);
      if (campaignSnap.exists()) {
        const data = campaignSnap.data();

        // Set campaign name
        setCampaignName(data?.title || "Campaign Chat");

        if (data?.approved?.includes(user?.uid)) {
          setIsApproved(true);
          console.log("approved");
        } else {
          setIsApproved(false);
        }
      } else {
        setIsApproved(false);
      }
      setLoading(false);
    };
    fetchApproval();
  }, []);

  // Fetch all approved users for the campaign
  useEffect(() => {
    if (!campaignId || !isApproved) return;

    const fetchApprovedUsers = async () => {
      setLoadingApprovedUsers(true);
      try {
        console.log("Fetching approved users for campaign:", campaignId);
        const campaignRef = doc(db, "campaigns", campaignId as string);
        const campaignSnap = await getDoc(campaignRef);

        if (campaignSnap.exists()) {
          const campaignData = campaignSnap.data();
          const approvedUserIds = campaignData?.approved || [];

          console.log(
            "Found approved user IDs:",
            approvedUserIds.length,
            approvedUserIds
          );
          setApprovedUserCount(approvedUserIds.length);

          // Fetch user data for all approved users
          const approvedUsersData: any[] = [];

          for (const userId of approvedUserIds) {
            try {
              const userDoc = await getDoc(doc(db, "users", userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                approvedUsersData.push({
                  id: userDoc.id,
                  ...userData,
                });
                console.log("Added user:", userData?.name || "Unknown");
              } else {
                console.log("User document not found for ID:", userId);
              }
            } catch (error) {
              console.error(
                "Error fetching approved user data for",
                userId,
                ":",
                error
              );
            }
          }

          console.log(
            "Final approved users data:",
            approvedUsersData.length,
            "users"
          );

          // Sort users alphabetically by name
          approvedUsersData.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );
          setApprovedUsers(approvedUsersData);
        } else {
          console.log("Campaign document not found");
        }
      } catch (error) {
        console.error("Error fetching approved users:", error);
      } finally {
        setLoadingApprovedUsers(false);
      }
    };

    fetchApprovedUsers();
  }, [campaignId, isApproved]);

  // Listen for messages in real-time (only if approved)
  useEffect(() => {
    if (!campaignId || !isApproved) return;
    const messagesRef = collection(
      db,
      "campaigns",
      campaignId as string,
      "chat"
    );
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(100));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messagesList: Message[] = [];
      const userIds = new Set<string>();

      snapshot.forEach((doc) => {
        const messageData = doc.data();
        // Filter out messages from blocked users
        if (!blockedUsers.includes(messageData.userId)) {
          messagesList.push({
            id: doc.id,
            ...messageData,
          } as Message);
          userIds.add(messageData.userId);
        }
      });

      setUserCount(userIds.size);

      // Fetch user data for profile images
      const updatedUserCache = { ...userCache };
      const usersArray: any[] = [];
      let cacheUpdated = false;

      for (const userId of userIds) {
        if (!updatedUserCache[userId]) {
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              updatedUserCache[userId] = userData;
              usersArray.push({
                id: userDoc.id,
                ...userData,
              });
              cacheUpdated = true;
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
          }
        } else {
          usersArray.push({
            id: userId,
            ...updatedUserCache[userId],
          });
        }
      }

      if (cacheUpdated) {
        setUserCache(updatedUserCache);
      }

      // Sort users alphabetically by name
      usersArray.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAllUsers(usersArray);

      const messagesWithPhotos = messagesList.map((message) => ({
        ...message,
        userPhotoUrl: updatedUserCache[message.userId]?.photoUrl,
      }));

      setMessages(messagesWithPhotos.reverse());

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsubscribe();
  }, [campaignId, isApproved, blockedUsers]);

  // Update messages when user cache changes
  useEffect(() => {
    if (messages.length > 0) {
      const updatedMessages = messages.map((message) => ({
        ...message,
        userPhotoUrl: userCache[message.userId]?.photoUrl,
      }));
      const hasChanges = updatedMessages.some(
        (msg, index) => msg.userPhotoUrl !== messages[index].userPhotoUrl
      );
      if (hasChanges) {
        setMessages(updatedMessages);
      }
    }
  }, [userCache]);

  // Listen for message reactions in real-time
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    messages.forEach((msg) => {
      const msgRef = doc(db, "campaigns", campaignId as string, "chat", msg.id);
      const unsubscribe = onSnapshot(msgRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()!;
          if (data.reactions) {
            setReactions((prev) => ({ ...prev, [msg.id]: data.reactions }));
          }
        }
      });
      unsubscribes.push(unsubscribe);
    });
    return () => unsubscribes.forEach((u) => u());
  }, [messages]);

  // Animate emoji picker visibility
  useEffect(() => {
    if (emojiPickerVisible) {
      Animated.timing(emojiAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(emojiAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [emojiPickerVisible]);

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUser || !campaignId) return;
    try {
      const messageData: any = {
        text: inputText.trim(),
        userId: currentUser.uid,
        userName:
          currentUserData?.name ||
          currentUser.displayName ||
          currentUser.email?.split("@")[0] ||
          "Anonymous",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      // Add reply data if replying to a message
      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          userName: replyingTo.userName,
        };
      }

      await addDoc(
        collection(db, "campaigns", campaignId as string, "chat"),
        messageData
      );
      setInputText("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getAvatarColor = (userId: string) => {
    const colors = [
      "#3B82F6",
      "#EF4444",
      "#10B981",
      "#F59E0B",
      "#8B5CF6",
      "#EC4899",
      "#06B6D4",
      "#84CC16",
    ];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Function to render text with clickable links and mentions
  const renderTextWithLinks = (text: string, isMyMessage: boolean) => {
    // Enhanced URL detection regex patterns
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const domainRegex = /([a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
    const mentionRegex = /(@\w+)/g;
    const tiktokRegex = /((?:https?:\/\/)?(?:www\.)?tiktok\.com\/[^\s]+)/g;
    const tiktokMobileRegex = /((?:https?:\/\/)?(?:vm\.)?tiktok\.com\/[^\s]+)/g;

    // Check if the message contains any URLs (including domains without protocol)
    const hasUrl =
      urlRegex.test(text) ||
      domainRegex.test(text) ||
      tiktokRegex.test(text) ||
      tiktokMobileRegex.test(text);

    if (hasUrl) {
      return (
        <View>
          {/* Render the text with clickable links and mentions */}
          <View className="mb-2">
            <Text
              className={`text-base leading-5 ${
                isMyMessage ? "text-white" : "text-gray-900"
              }`}
            >
              {(() => {
                // Enhanced combined regex to match URLs, domains, TikTok links, and mentions
                const combinedRegex =
                  /(https?:\/\/[^\s]+|(?:www\.)?tiktok\.com\/[^\s]+|(?:vm\.)?tiktok\.com\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*|@\w+)/g;
                const parts = text.split(combinedRegex);

                return parts.map((part, index) => {
                  if (
                    urlRegex.test(part) ||
                    tiktokRegex.test(part) ||
                    tiktokMobileRegex.test(part)
                  ) {
                    // Handle full URLs and TikTok links
                    return (
                      <Text
                        key={index}
                        className={`${
                          isMyMessage ? "text-blue-200" : "text-blue-600"
                        } underline`}
                        onPress={() => {
                          let linkToOpen = part;
                          // Add protocol if missing
                          if (!part.startsWith("http")) {
                            linkToOpen = `https://${part}`;
                          }
                          Linking.openURL(linkToOpen).catch((err) =>
                            console.error("Failed to open URL:", err)
                          );
                        }}
                      >
                        {part}
                      </Text>
                    );
                  } else if (domainRegex.test(part)) {
                    // Handle domain-only URLs
                    return (
                      <Text
                        key={index}
                        className={`${
                          isMyMessage ? "text-blue-200" : "text-blue-600"
                        } underline`}
                        onPress={() => {
                          const linkToOpen = part.startsWith("http")
                            ? part
                            : `https://${part}`;
                          Linking.openURL(linkToOpen).catch((err) =>
                            console.error("Failed to open URL:", err)
                          );
                        }}
                      >
                        {part}
                      </Text>
                    );
                  } else if (mentionRegex.test(part)) {
                    return (
                      <Text
                        key={index}
                        className={`${
                          isMyMessage ? "text-blue-200" : "text-blue-600"
                        } font-medium`}
                      >
                        {part}
                      </Text>
                    );
                  }
                  return part;
                });
              })()}
            </Text>
          </View>

          {/* Enhanced Link Preview with TikTok handling */}
          <View
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: isMyMessage
                ? "rgba(255,255,255,0.1)"
                : "#f3f4f6",
              maxWidth: 280,
            }}
          >
            <LinkPreview
              text={text}
              renderTitle={(title) => (
                <Text
                  style={{
                    color: isMyMessage ? "white" : "black",
                    fontSize: 14,
                    fontWeight: "600",
                    paddingHorizontal: 8,
                    paddingTop: 8,
                  }}
                  numberOfLines={2}
                >
                  {title}
                </Text>
              )}
              renderText={(linkText) => (
                <Text
                  numberOfLines={1}
                  style={{
                    color: isMyMessage
                      ? "rgba(255,255,255,0.8)"
                      : "rgba(0,0,0,0.6)",
                    fontSize: 12,
                    paddingHorizontal: 8,
                    paddingBottom: 4,
                  }}
                >
                  {linkText}
                </Text>
              )}
              renderDescription={(desc) => (
                <Text
                  style={{
                    color: isMyMessage
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(0,0,0,0.8)",
                    fontSize: 13,
                    paddingHorizontal: 8,
                    paddingBottom: 8,
                  }}
                  numberOfLines={3}
                >
                  {desc}
                </Text>
              )}
              renderHeader={(header) => (
                <Text
                  style={{
                    color: isMyMessage
                      ? "rgba(255,255,255,0.7)"
                      : "rgba(0,0,0,0.5)",
                    fontSize: 11,
                    paddingHorizontal: 8,
                    paddingTop: 4,
                  }}
                >
                  {header}
                </Text>
              )}
              renderImage={(imageProps) => (
                <Image
                  source={{ uri: imageProps.url }}
                  contentFit="cover"
                  style={{
                    width: 280,
                    height: 150,

                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                  onError={(error) => {
                    console.log("Image loading error:", error);
                  }}
                />
              )}
              containerStyle={{
                backgroundColor: "transparent",
                borderRadius: 8,
                overflow: "hidden",
              }}
              textContainerStyle={{
                backgroundColor: "transparent",
                padding: 0,
              }}
            />
          </View>
        </View>
      );
    }

    // For messages without URLs, render normally with mentions
    const combinedRegex =
      /(https?:\/\/[^\s]+|(?:www\.)?tiktok\.com\/[^\s]+|(?:vm\.)?tiktok\.com\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*|@\w+)/g;
    const parts = text.split(combinedRegex);

    return (
      <Text
        className={`text-base leading-5 ${
          isMyMessage ? "text-white" : "text-gray-900"
        }`}
      >
        {parts.map((part, index) => {
          if (
            urlRegex.test(part) ||
            tiktokRegex.test(part) ||
            tiktokMobileRegex.test(part)
          ) {
            return (
              <Text
                key={index}
                className={`${
                  isMyMessage ? "text-blue-200" : "text-blue-600"
                } underline`}
                onPress={() => {
                  let linkToOpen = part;
                  if (!part.startsWith("http")) {
                    linkToOpen = `https://${part}`;
                  }
                  Linking.openURL(linkToOpen).catch((err) =>
                    console.error("Failed to open URL:", err)
                  );
                }}
              >
                {part}
              </Text>
            );
          } else if (domainRegex.test(part)) {
            return (
              <Text
                key={index}
                className={`${
                  isMyMessage ? "text-blue-200" : "text-blue-600"
                } underline`}
                onPress={() => {
                  const linkToOpen = part.startsWith("http")
                    ? part
                    : `https://${part}`;
                  Linking.openURL(linkToOpen).catch((err) =>
                    console.error("Failed to open URL:", err)
                  );
                }}
              >
                {part}
              </Text>
            );
          } else if (mentionRegex.test(part)) {
            return (
              <Text
                key={index}
                className={`${
                  isMyMessage ? "text-blue-200" : "text-blue-600"
                } font-medium`}
              >
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  // Add or remove reaction
  const handleReact = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    const msgRef = doc(
      db,
      "campaigns",
      campaignId as string,
      "chat",
      messageId
    );
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists() || !msgSnap.data()) return;
    const data = msgSnap.data()!;
    const currentReactions = data.reactions || {};
    const users = currentReactions[emoji] || [];
    let newUsers;
    if (users.includes(currentUser.uid)) {
      newUsers = users.filter((id: string) => id !== currentUser.uid);
    } else {
      newUsers = [...users, currentUser.uid];
    }
    const newReactions = { ...currentReactions, [emoji]: newUsers };
    await updateDoc(msgRef, { reactions: newReactions });
    setEmojiPickerVisible(false);
    setEmojiPickerMessageId(null);
  };

  // Open profile modal
  const openProfileModal = (userId: string) => {
    setSelectedUser(userCache[userId]);
    setProfileModalVisible(true);
  };

  // Report message function
  const handleReportMessage = async (reason: string) => {
    if (!reportingMessage || !currentUser) return;

    try {
      const reportData = {
        messageId: reportingMessage.id,
        messageText: reportingMessage.text,
        reportedUserId: reportingMessage.userId,
        reportedUserName: reportingMessage.userName,
        reporterUserId: currentUser.uid,
        reporterUserName:
          currentUser.displayName ||
          currentUser.email?.split("@")[0] ||
          "Anonymous",
        reason: reason,
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, "messageReports"), reportData);

      Alert.alert(
        "Report Submitted",
        "Thank you for reporting this message. Our team will review it.",
        [{ text: "OK" }]
      );

      setReportModalVisible(false);
      setReportingMessage(null);
    } catch (error) {
      console.error("Error reporting message:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    }
  };

  // Block user function
  const handleBlockUser = async (userIdToBlock: string) => {
    if (!currentUser || userIdToBlock === currentUser.uid) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        blockedUsers: arrayUnion(userIdToBlock),
      });

      Alert.alert(
        "User Blocked",
        "You will no longer see messages from this user.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error blocking user:", error);
      Alert.alert("Error", "Failed to block user. Please try again.");
    }
  };

  // Unblock user function
  const handleUnblockUser = async (userIdToUnblock: string) => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        blockedUsers: arrayRemove(userIdToUnblock),
      });

      Alert.alert(
        "User Unblocked",
        "You can now see messages from this user again.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error unblocking user:", error);
      Alert.alert("Error", "Failed to unblock user. Please try again.");
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.userId === currentUser?.uid;
    // Always show avatar and name for every message
    const showAvatar = true;
    const showName = true;
    const msgReactions = reactions[item.id] || {};
    const user = userCache[item.userId] || {};
    const isAdmin = user.isAdmin || user.role === "admin";
    const currentUserData = userCache[currentUser?.uid] || {};
    const isCurrentUserAdmin =
      currentUserData.isAdmin || currentUserData.role === "admin";

    const handleDeleteMessage = async (messageId: string) => {
      Alert.alert(
        "Delete Message",
        "Are you sure you want to delete this message? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteDoc(
                  doc(db, "campaigns", campaignId as string, "chat", messageId)
                );
              } catch (e) {
                Alert.alert("Error", "Failed to delete message.");
              }
            },
          },
        ]
      );
    };

    return (
      <View className={`mb-4 ${isMyMessage ? "items-end" : "items-start"}`}>
        <View
          className={`flex-row items-start max-w-[80%] ${
            isMyMessage ? "flex-row-reverse" : ""
          }`}
        >
          {/* Avatar for other users (left side) */}
          {!isMyMessage && (
            <View className="mr-3">
              {showAvatar ? (
                <TouchableOpacity onPress={() => openProfileModal(item.userId)}>
                  <View className="w-10 h-10 rounded-full overflow-hidden">
                    {item.userPhotoUrl ? (
                      <Image
                        source={{ uri: item.userPhotoUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        className="w-full h-full items-center justify-center"
                        style={{ backgroundColor: getAvatarColor(item.userId) }}
                      >
                        <Text className="text-white font-gBold text-lg">
                          {item.userName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                <View className="w-10 h-10" />
              )}
            </View>
          )}

          {/* Avatar for current user (right side) */}
          {isMyMessage && (
            <View className="ml-3">
              {showAvatar ? (
                <TouchableOpacity onPress={() => openProfileModal(item.userId)}>
                  <View className="w-10 h-10 rounded-full overflow-hidden">
                    {item.userPhotoUrl ? (
                      <Image
                        source={{ uri: item.userPhotoUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        className="w-full h-full items-center justify-center"
                        style={{ backgroundColor: getAvatarColor(item.userId) }}
                      >
                        <Text className="text-white font-gBold text-lg">
                          {item.userName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                <View className="w-10 h-10" />
              )}
            </View>
          )}

          {/* Message content wrapper */}
          <View>
            {/* Message Bubble */}
            <TouchableOpacity
              onLongPress={() => {
                setEmojiPickerVisible(true);
                setEmojiPickerMessageId(item.id);
              }}
              activeOpacity={0.8}
            >
              <View
                className={`px-4 py-3 ${
                  isMyMessage ? "bg-blue-500" : "bg-gray-100"
                }`}
                style={{
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  borderBottomLeftRadius: isMyMessage ? 18 : 0,
                  borderBottomRightRadius: isMyMessage ? 0 : 18,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    {showName && !isMyMessage && (
                      <View className="flex-row items-center">
                        <Text
                          className={`text-sm font-semibold ${
                            isAdmin ? "text-[#5680e9]" : "text-gray-500"
                          }`}
                        >
                          @{item.userName}
                        </Text>
                        {isAdmin && (
                          <Ionicons
                            name="star"
                            size={14}
                            color="#FCD34D"
                            style={{ marginLeft: 6 }}
                          />
                        )}
                      </View>
                    )}
                  </View>
                </View>
                {/* Reply Section */}
                {item.replyTo && (
                  <View className="mb-2 p-2 bg-black/10 rounded-lg border-l-2 border-blue-400">
                    <Text
                      className={`text-xs font-medium ${
                        isMyMessage ? "text-blue-200" : "text-blue-600"
                      }`}
                    >
                      @{item.replyTo.userName}
                    </Text>
                    <Text
                      className={`text-sm ${
                        isMyMessage ? "text-white/80" : "text-gray-600"
                      }`}
                      numberOfLines={2}
                    >
                      {item.replyTo.text}
                    </Text>
                  </View>
                )}
                {renderTextWithLinks(item.text, isMyMessage)}
              </View>
            </TouchableOpacity>
            {/* Reactions Row */}
            {Object.keys(msgReactions).length > 0 && (
              <View className="flex-row mt-1 gap-x-2">
                {Object.entries(msgReactions).map(
                  ([emoji, users]) =>
                    users.length > 0 && (
                      <TouchableOpacity
                        key={emoji}
                        className="flex-row items-center bg-gray-200 rounded-full px-2 py-1"
                        onPress={() => handleReact(item.id, emoji)}
                      >
                        <Text style={{ fontSize: 16 }}>{emoji}</Text>
                        <Text className="ml-1 text-gray-700 font-gMedium text-xs">
                          {users.length}
                        </Text>
                      </TouchableOpacity>
                    )
                )}
              </View>
            )}
            {/* Timestamp */}
            <Text
              className={`text-gray-400 text-xs mt-1 ${
                isMyMessage ? "text-right" : "text-left"
              }`}
            >
              {formatTime(item.timestamp)}
            </Text>
          </View>
        </View>
        {/* Emoji Picker */}
        {emojiPickerVisible && emojiPickerMessageId === item.id && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
          >
            {/* Overlay to close emoji picker */}
            <TouchableOpacity
              activeOpacity={1}
              style={{
                position: "absolute",
                top: -1000,
                left: -1000,
                right: -1000,
                bottom: -1000,
                zIndex: 998,
              }}
              onPress={() => {
                setEmojiPickerVisible(false);
                setEmojiPickerMessageId(null);
              }}
            />
            <Animated.View
              style={{
                backgroundColor: "white",
                borderRadius: 9999,
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 2 },
                elevation: 8,
                padding: 8,
                position: "absolute",
                zIndex: 999,
                top: Math.max(-56, -56),
                left: isMyMessage ? undefined : 0,
                right: isMyMessage ? 0 : undefined,
                maxWidth: 300,
                opacity: emojiAnim,
                transform: [
                  {
                    scale: emojiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                ],
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                {/* Safety features first for other users' messages */}
                {!isMyMessage && (
                  <>
                    {/* Report button - most prominent */}
                    <TouchableOpacity
                      style={{
                        marginRight: 8,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "#FEF2F2",
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: "#FECACA",
                      }}
                      onPress={() => {
                        setReportingMessage(item);
                        setReportModalVisible(true);
                        setEmojiPickerVisible(false);
                        setEmojiPickerMessageId(null);
                      }}
                    >
                      <Ionicons name="flag" size={20} color="#DC2626" />
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#DC2626",
                          fontWeight: "600",
                          marginTop: 2,
                        }}
                      >
                        Report
                      </Text>
                    </TouchableOpacity>
                    {/* Block button - prominent */}
                    <TouchableOpacity
                      style={{
                        marginRight: 12,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "#FEF2F2",
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: "#FECACA",
                      }}
                      onPress={() => {
                        Alert.alert(
                          "Block User",
                          `Are you sure you want to block @${item.userName}? You won't see their messages anymore.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Block",
                              style: "destructive",
                              onPress: () => {
                                handleBlockUser(item.userId);
                                setEmojiPickerVisible(false);
                                setEmojiPickerMessageId(null);
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="ban" size={20} color="#DC2626" />
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#DC2626",
                          fontWeight: "600",
                          marginTop: 2,
                        }}
                      >
                        Block
                      </Text>
                    </TouchableOpacity>
                    {/* Visual separator */}
                    <View
                      style={{
                        width: 1,
                        height: 32,
                        backgroundColor: "#E5E7EB",
                        marginRight: 12,
                      }}
                    />
                  </>
                )}
                {/* Reply button */}
                <TouchableOpacity
                  style={{
                    marginRight: 8,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#EFF6FF",
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                  }}
                  onPress={() => {
                    setReplyingTo(item);
                    setEmojiPickerVisible(false);
                    setEmojiPickerMessageId(null);
                  }}
                >
                  <Ionicons name="arrow-undo" size={18} color="#3B82F6" />
                  <Text
                    style={{
                      fontSize: 9,
                      color: "#3B82F6",
                      fontWeight: "500",
                      marginTop: 1,
                    }}
                  >
                    Reply
                  </Text>
                </TouchableOpacity>
                {/* Visual separator */}
                <View
                  style={{
                    width: 1,
                    height: 32,
                    backgroundColor: "#E5E7EB",
                    marginRight: 8,
                  }}
                />
                {/* Emoji reactions - secondary position */}
                {EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={{ marginHorizontal: 3 }}
                    onPress={() => handleReact(item.id, emoji)}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
                {/* Delete button - for own messages or admin */}
                {(isMyMessage || isCurrentUserAdmin) && (
                  <TouchableOpacity
                    style={{
                      marginLeft: 8,
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: "#FEF2F2",
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                    }}
                    onPress={() => handleDeleteMessage(item.id)}
                  >
                    <Ionicons name="trash" size={18} color="#DC2626" />
                    <Text
                      style={{
                        fontSize: 9,
                        color: "#DC2626",
                        fontWeight: "500",
                        marginTop: 1,
                      }}
                    >
                      Delete
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        )}
      </View>
    );
  };

  if (loading || isApproved === null) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6476E8" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isApproved) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        {/* Header with Back Button */}
        <View className="border-b border-gray-100 px-4 py-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 p-2 -ml-2"
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="font-gBold text-lg text-gray-900">
            {campaignName}
          </Text>
        </View>

        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="lock-closed-outline" size={64} color="#9CA3AF" />
          <Text className="text-gray-500 text-lg font-medium mt-4">
            Access Denied
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            Only approved users can join this campaign chat.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View className="border-b border-gray-100 px-4 py-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 p-2 -ml-2"
            >
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>

            <View>
              <Text className="font-gBold text-lg text-gray-900">
                {campaignName}
              </Text>
              <Text className="text-gray-500 text-sm">
                Internal chat for approved users
              </Text>
            </View>
          </View>
          {/* User count badge */}
          <TouchableOpacity
            className="flex-row items-center border border-gray-200 rounded-full px-4 py-1 ml-2"
            style={{ minWidth: 48 }}
            onPress={() => setUsersListVisible(true)}
          >
            <Ionicons
              name="people"
              size={20}
              color="#444"
              style={{ marginRight: 4 }}
            />
            <Text className="text-gray-700 text-base font-gMedium">
              {approvedUserCount}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <View className="flex-1">
          {messages.length === 0 ? (
            <View className="flex-1 justify-center items-center px-8">
              <Ionicons name="chatbubble-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 text-lg font-medium mt-4">
                No messages yet
              </Text>
              <Text className="text-gray-400 text-center mt-2">
                Be the first to start the conversation!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingVertical: 56,
              }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
              onScrollBeginDrag={() => {
                Keyboard.dismiss();
              }}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {/* Reply UI */}
        {replyingTo && (
          <View className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-medium text-blue-600">
                  Replying to @{replyingTo.userName}
                </Text>
                <Text className="text-sm text-gray-600" numberOfLines={1}>
                  {replyingTo.text}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center ml-3"
              >
                <Ionicons name="close" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Message Input */}
        <View className="px-4 py-4 bg-white">
          <View className="flex-row items-end">
            <View
              className={`flex-1 bg-gray-100 px-4 py-2 mr-3 ${
                inputHeight > 60 ? "rounded-2xl" : "rounded-full"
              }`}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                placeholderTextColor="#9CA3AF"
                className="text-base text-gray-900"
                multiline
                maxLength={500}
                textAlignVertical="top"
                style={{
                  fontSize: 16,
                  minHeight: 40,
                  maxHeight: 120,
                }}
                onContentSizeChange={(e) => {
                  setInputHeight(e.nativeEvent.contentSize.height);
                }}
              />
            </View>

            <TouchableOpacity
              onPress={sendMessage}
              disabled={!inputText.trim()}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                inputText.trim() ? "bg-blue-500" : "bg-gray-200"
              }`}
            >
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim() ? "white" : "#9CA3AF"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Users List Modal */}
        <Modal
          visible={usersListVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setUsersListVisible(false)}
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => setUsersListVisible(false)}
          >
            <View className="bg-white rounded-t-3xl" style={{ height: "70%" }}>
              <View className="bg-white rounded-t-3xl p-6">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="font-gBold text-xl text-gray-900">
                    Approved Members ({approvedUsers.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => setUsersListVisible(false)}
                    className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center"
                  >
                    <Ionicons name="close" size={18} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                {loadingApprovedUsers ? (
                  <View className="flex-1 justify-center items-center py-8">
                    <ActivityIndicator size="large" color="#6476E8" />
                    <Text className="text-gray-500 mt-2">
                      Loading members...
                    </Text>
                  </View>
                ) : approvedUsers.length === 0 ? (
                  <View className="flex-1 justify-center items-center py-8">
                    <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                    <Text className="text-gray-500 text-lg font-medium mt-4">
                      No members found
                    </Text>
                    <Text className="text-gray-400 text-center mt-2">
                      There are no approved members for this campaign yet.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={approvedUsers}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => {
                      const isAdmin = item.isAdmin || item.role === "admin";
                      return (
                        <TouchableOpacity
                          className="flex-row items-center py-3 border-b border-gray-100"
                          onPress={() => {
                            setSelectedUser(item);
                            setProfileModalVisible(true);
                            setUsersListVisible(false);
                          }}
                        >
                          <View className="w-12 h-12 rounded-full overflow-hidden mr-3">
                            {item.photoUrl ? (
                              <Image
                                source={{ uri: item.photoUrl }}
                                style={{ width: "100%", height: "100%" }}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                className="w-full h-full items-center justify-center"
                                style={{
                                  backgroundColor: getAvatarColor(item.id),
                                }}
                              >
                                <Text className="text-white font-gBold text-lg">
                                  {(item.name || "User")
                                    .charAt(0)
                                    .toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center">
                              <Text className="font-gMedium text-base text-gray-900">
                                {item.name}
                              </Text>
                              {isAdmin && (
                                <Ionicons
                                  name="star"
                                  size={16}
                                  color="#FCD34D"
                                  style={{ marginLeft: 6 }}
                                />
                              )}
                            </View>
                            {item.university && (
                              <Text
                                className="text-gray-500 text-sm"
                                numberOfLines={1}
                              >
                                {item.university}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Profile Modal */}
        <Modal
          visible={profileModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <View className="flex-1 bg-black/40 justify-center items-center">
            <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
              {!selectedUser ? (
                <ActivityIndicator size="large" color="#6476E8" />
              ) : (
                <>
                  <View className="items-center mb-4">
                    <View className="w-24 h-24 rounded-full mb-2 overflow-hidden">
                      {selectedUser.photoUrl ? (
                        <Image
                          source={{ uri: selectedUser.photoUrl }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          className="w-full h-full items-center justify-center"
                          style={{
                            backgroundColor: getAvatarColor(
                              selectedUser.uid || selectedUser.id || "default"
                            ),
                          }}
                        >
                          <Text className="text-white font-gBold text-2xl">
                            {(selectedUser.name || "User")
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="font-gBold text-2xl mb-1">
                      {selectedUser.name}
                    </Text>
                    {selectedUser.username && (
                      <Text className="text-gray-500 mb-1">
                        @{selectedUser.username}
                      </Text>
                    )}
                    {selectedUser.university && (
                      <Text className="text-gray-600 mb-1">
                        {selectedUser.university}
                      </Text>
                    )}
                  </View>
                  {selectedUser.bio && (
                    <Text className="text-gray-700 mb-3 text-center">
                      {selectedUser.bio}
                    </Text>
                  )}
                  <View className="flex-row justify-center gap-x-2 mb-2">
                    {selectedUser.tiktok && (
                      <TouchableOpacity
                        onPress={() => {
                          Linking.openURL(
                            `https://tiktok.com/@${selectedUser.tiktok.replace(
                              /^@/,
                              ""
                            )}`
                          );
                        }}
                        className="bg-gray-100 rounded-full px-3 py-1 flex-row items-center"
                      >
                        <Ionicons name="logo-tiktok" size={20} color="#000" />
                        <Text className="ml-1 text-gray-700 font-gMedium">
                          @{selectedUser.tiktok.replace(/^@/, "")}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {selectedUser.instagram && (
                      <TouchableOpacity
                        onPress={() => {
                          Linking.openURL(
                            `https://instagram.com/${selectedUser.instagram.replace(
                              /^@/,
                              ""
                            )}`
                          );
                        }}
                        className="bg-gray-100 rounded-full px-3 py-1 flex-row items-center"
                      >
                        <Ionicons
                          name="logo-instagram"
                          size={20}
                          color="#C13584"
                        />
                        <Text className="ml-1 text-gray-700 font-gMedium">
                          @{selectedUser.instagram.replace(/^@/, "")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    className="bg-gray-200 rounded-xl py-3 items-center mt-2"
                    onPress={() => setProfileModalVisible(false)}
                  >
                    <Text className="text-gray-700 font-gBold text-base">
                      Close
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Report Modal */}
        <Modal
          visible={reportModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setReportModalVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-center items-center">
            <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-gray-900">
                  Report Message
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setReportModalVisible(false);
                    setReportingMessage(null);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text className="text-gray-600 mb-4">
                Why are you reporting this message?
              </Text>

              <View className="space-y-2 mb-6">
                {REPORT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => handleReportMessage(reason)}
                    className="py-3 px-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <Text className="text-gray-900 font-medium">{reason}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default CampaignChat;
