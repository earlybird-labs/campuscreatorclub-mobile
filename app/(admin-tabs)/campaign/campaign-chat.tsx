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
  getDocs,
  startAfter,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import functions from "@react-native-firebase/functions";
import { useLocalSearchParams, router } from "expo-router";
import { Linking } from "react-native";
import { LinkPreview } from "@flyerhq/react-native-link-preview";

interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  timestamp: any;
  createdAt: any;
  everyoneMention?: boolean;
  replyTo?: {
    id: string;
    text: string;
    userName: string;
  };
}

const EMOJIS = ["🤖", "😎", "😂", "❤️", "🙌"];

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
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [campaignName, setCampaignName] = useState<string>("Campaign Chat");
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(
    null
  );
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  // Pagination and scroll state
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [lastMessageDoc, setLastMessageDoc] = useState<any>(null);

  const db = getFirestore();
  const auth = getAuth();

  // Get current user and fetch user data
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);

      // Fetch current user data including blocked users
      const fetchCurrentUserData = async () => {
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
          console.error("Error fetching current user data:", error);
        }
      };

      fetchCurrentUserData();

      // Listen for changes to current user data
      const unsubscribe = onSnapshot(doc(db, "users", user.uid), (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          if (userData) {
            setCurrentUserData(userData);
            setBlockedUsers(userData.blockedUsers || []);
          }
        }
      });

      return () => unsubscribe();
    }
  }, []);

  // Check if user is approved for this campaign
  useEffect(() => {
    const fetchApproval = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsApproved(false);
        setLoading(false);
        return;
      }

      // Check if user is admin first
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData?.isAdmin || userData?.role === "admin") {
          // Still fetch campaign name for admin
          try {
            const campaignRef = doc(db, "campaigns", campaignId as string);
            const campaignSnap = await getDoc(campaignRef);
            if (campaignSnap.exists()) {
              const campaignData = campaignSnap.data();
              setCampaignName(campaignData?.title || "Campaign Chat");
            }
          } catch (error) {
            console.error("Error fetching campaign data:", error);
          }

          setIsApproved(true);
          setLoading(false);
          return;
        }
      }

      // If not admin, check campaign approval
      const campaignRef = doc(db, "campaigns", campaignId as string);
      const campaignSnap = await getDoc(campaignRef);
      if (campaignSnap.exists()) {
        const data = campaignSnap.data();

        // Set campaign name
        setCampaignName(data?.title || "Campaign Chat");

        if (data?.approved?.includes(user?.uid)) {
          setIsApproved(true);
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
        const campaignRef = doc(db, "campaigns", campaignId as string);
        const campaignSnap = await getDoc(campaignRef);

        if (campaignSnap.exists()) {
          const campaignData = campaignSnap.data();
          const approvedUserIds = campaignData?.approved || [];

          setApprovedUserCount(approvedUserIds.length);

          // Fetch user data for all approved users more efficiently
          const approvedUsersData: any[] = [];

          // Batch fetch user data instead of individual requests
          const userPromises = approvedUserIds.map(async (userId: string) => {
            try {
              const userDoc = await getDoc(doc(db, "users", userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                return {
                  id: userDoc.id,
                  ...userData,
                };
              }
              return null;
            } catch (error) {
              console.error(
                "Error fetching approved user data for",
                userId,
                ":",
                error
              );
              return null;
            }
          });

          const userResults = await Promise.all(userPromises);
          approvedUsersData.push(...userResults.filter(Boolean));

          // Sort users alphabetically by name
          approvedUsersData.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );
          setApprovedUsers(approvedUsersData);
        } else {
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
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(20));

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

      // Set pagination state
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      setLastMessageDoc(lastDoc);
      setHasMoreMessages(snapshot.docs.length === 20);

      setMessages(messagesWithPhotos.reverse());

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
        setShowScrollToBottom(false);
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

  // Load more messages for pagination
  const loadMoreMessages = async () => {
    if (
      !hasMoreMessages ||
      loadingMoreMessages ||
      !lastMessageDoc ||
      !campaignId
    )
      return;

    setLoadingMoreMessages(true);
    try {
      const messagesRef = collection(
        db,
        "campaigns",
        campaignId as string,
        "chat"
      );
      const q = query(
        messagesRef,
        orderBy("createdAt", "desc"),
        startAfter(lastMessageDoc),
        limit(20)
      );

      const snapshot = await getDocs(q);
      const newMessages: Message[] = [];
      let newLastDoc = null;

      snapshot.forEach((docSnap, index) => {
        const messageData = docSnap.data();
        // Filter out messages from blocked users
        if (!blockedUsers.includes(messageData.userId)) {
          newMessages.push({
            id: docSnap.id,
            ...messageData,
          } as Message);
        }
        // Set the last document for next pagination
        if (index === snapshot.docs.length - 1) {
          newLastDoc = docSnap;
        }
      });

      if (newMessages.length > 0) {
        // Batch fetch user data for new messages
        const userIds = [...new Set(newMessages.map((msg) => msg.userId))];
        const missingUserIds = userIds.filter((userId) => !userCache[userId]);

        if (missingUserIds.length > 0) {
          const userPromises = missingUserIds.map(async (userId: string) => {
            try {
              const userDoc = await getDoc(doc(db, "users", userId));
              if (userDoc.exists()) {
                return { userId, userData: userDoc.data() };
              }
              return null;
            } catch (error) {
              console.error("Error fetching user data:", error);
              return null;
            }
          });

          const userResults = await Promise.all(userPromises);
          const newUserCache = { ...userCache };
          userResults.forEach((result) => {
            if (result) {
              newUserCache[result.userId] = result.userData;
            }
          });
          setUserCache(newUserCache);
        }

        // Add user photo URLs to new messages
        const messagesWithPhotos = newMessages.map((message) => ({
          ...message,
          userPhotoUrl: userCache[message.userId]?.photoUrl,
        }));

        // Prepend new messages to existing ones
        setMessages((prevMessages) => [
          ...messagesWithPhotos.reverse(),
          ...prevMessages,
        ]);
        setLastMessageDoc(newLastDoc);
      }

      // Update hasMoreMessages based on results
      setHasMoreMessages(snapshot.docs.length === 20);
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  // Scroll to bottom functionality
  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollToBottom(false);
  };

  // Handle scroll events to show/hide scroll to bottom button
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 200;
    setShowScrollToBottom(!isAtBottom && messages.length > 0);
  };

  // Handle input text change for mention suggestions
  const handleInputChange = (text: string) => {
    setInputText(text);

    // Check for @ mentions
    const lastAtIndex = text.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const textAfterAt = text.substring(lastAtIndex + 1);
      const spaceIndex = textAfterAt.indexOf(" ");
      const queryText =
        spaceIndex === -1 ? textAfterAt : textAfterAt.substring(0, spaceIndex);

      if (queryText.length > 0 && spaceIndex === -1) {
        // Show suggestions for approved users whose names match the query
        const userSuggestions = approvedUsers
          .filter(
            (user) =>
              user.id !== currentUser?.uid &&
              user.name.toLowerCase().includes(queryText.toLowerCase())
          )
          .slice(0, 4); // Limit to 4 user suggestions

        const suggestions = [...userSuggestions];

        // Add @everyone suggestion for admins
        const isCurrentUserAdmin =
          currentUserData?.isAdmin || currentUserData?.role === "admin";
        if (
          isCurrentUserAdmin &&
          "everyone".includes(queryText.toLowerCase())
        ) {
          suggestions.unshift({
            id: "everyone",
            name: "everyone",
            isEveryone: true,
          });
        }

        setMentionQuery(queryText);
        setMentionSuggestions(suggestions);
        setShowMentionSuggestions(suggestions.length > 0);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  // Handle mention selection
  const selectMention = (user: any) => {
    const lastAtIndex = inputText.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const beforeAt = inputText.substring(0, lastAtIndex);
      const afterQuery = inputText.substring(
        lastAtIndex + 1 + mentionQuery.length
      );

      if (user.isEveryone) {
        setInputText(`${beforeAt}@everyone ${afterQuery}`);
      } else {
        const username = user.name.toLowerCase().replace(/\s+/g, "");
        setInputText(`${beforeAt}@${username} ${afterQuery}`);
      }
    }
    setShowMentionSuggestions(false);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUser || !campaignId) return;
    try {
      const messageText = inputText.trim();

      // Allow @everyone only for admins
      const isCurrentUserAdmin =
        currentUserData?.isAdmin || currentUserData?.role === "admin";
      const hasEveryoneMention = messageText.includes("@everyone");
      if (hasEveryoneMention && !isCurrentUserAdmin) {
        Alert.alert(
          "Permission Denied",
          "Only admins can use @everyone mentions."
        );
        return;
      }

      const messageData: any = {
        text: messageText,
        userId: currentUser.uid,
        userName:
          currentUserData?.name ||
          currentUser.displayName ||
          currentUser.email?.split("@")[0] ||
          "Anonymous",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      if (hasEveryoneMention) {
        messageData.everyoneMention = true;
      }

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

      // Send @everyone notifications to approved users
      if (hasEveryoneMention && isCurrentUserAdmin) {
        await sendEveryoneNotificationsToApproved(messageText);
      }

      setInputText("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  // Send @everyone notifications using Cloud Function
  const sendEveryoneNotificationsToApproved = async (
    messageText: string,
    messageId?: string
  ) => {
    try {
      // Call Cloud Function
      const sendEveryoneNotificationsFunction = functions().httpsCallable(
        "sendEveryoneNotifications"
      );

      await sendEveryoneNotificationsFunction({
        messageText,
        chatType: "campaign",
        chatId: campaignId,
        messageId: messageId || null,
      });
    } catch (error) {
      console.error("Error sending @everyone notifications (campaign):", error);
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
  const renderTextWithLinks = (
    text: string,
    isMyMessage: boolean,
    message?: Message
  ) => {
    // Enhanced URL detection patterns
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const domainRegex = /([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
    const mentionRegex = /(@\w+)/g;

    // Check if the message contains any URLs (both full URLs and domain-only)
    const hasUrl = urlRegex.test(text) || domainRegex.test(text);

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
                // Split by URLs (both full URLs and domain-only) and mentions
                const combinedRegex =
                  /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?|@\w+)/g;
                const parts = text.split(combinedRegex);

                return parts.map((part, index) => {
                  if (urlRegex.test(part)) {
                    // Handle full URLs
                    return (
                      <Text
                        key={index}
                        className={`${
                          isMyMessage ? "text-blue-200" : "text-blue-600"
                        } underline`}
                        onPress={() => {
                          Linking.openURL(part).catch((err) =>
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
                          const url = part.startsWith("http")
                            ? part
                            : `https://${part}`;
                          Linking.openURL(url).catch((err) =>
                            console.error("Failed to open URL:", err)
                          );
                        }}
                      >
                        {part}
                      </Text>
                    );
                  } else if (mentionRegex.test(part)) {
                    // Special styling for @everyone only if it's an admin message
                    if (part === "@everyone" && message?.everyoneMention) {
                      return (
                        <Text
                          key={index}
                          className={`${
                            isMyMessage ? "text-red-200" : "text-red-600"
                          } font-bold`}
                        >
                          {part}
                        </Text>
                      );
                    }
                    return (
                      <Text
                        key={index}
                        className={`${
                          isMyMessage ? "text-yellow-200" : "text-blue-600"
                        } font-bold`}
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

          {/* Link Preview */}
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
                    fontWeight: "600",
                    fontSize: 14,
                    marginBottom: 4,
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
                    marginBottom: 4,
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
                    lineHeight: 18,
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
                    fontWeight: "500",
                    marginBottom: 2,
                  }}
                  numberOfLines={1}
                >
                  {header}
                </Text>
              )}
              renderImage={(imageProps) => (
                <Image
                  source={{ uri: imageProps.url }}
                  contentFit="cover"
                  style={{
                    width: 250,
                    height: 140,

                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                  onError={(error) => {
                    console.warn("Link preview image failed to load:", error);
                  }}
                />
              )}
              containerStyle={{
                padding: 12,
                borderRadius: 8,
              }}
              textContainerStyle={{
                paddingHorizontal: 0,
                paddingVertical: 0,
              }}
            />
          </View>
        </View>
      );
    }

    // If no URLs, render normally with mentions
    const combinedRegex = /(@\w+)/g;
    const parts = text.split(combinedRegex);

    return (
      <Text
        className={`text-base leading-5 ${
          isMyMessage ? "text-white" : "text-gray-900"
        }`}
      >
        {parts.map((part, index) => {
          if (mentionRegex.test(part)) {
            // Special styling for @everyone only if it's an admin message
            if (part === "@everyone" && message?.everyoneMention) {
              return (
                <Text
                  key={index}
                  className={`${
                    isMyMessage ? "text-red-200" : "text-red-600"
                  } font-bold`}
                >
                  {part}
                </Text>
              );
            }
            return (
              <Text
                key={index}
                className={`${
                  isMyMessage ? "text-yellow-200" : "text-blue-600"
                } font-bold`}
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

  // Block/unblock user functions
  const handleBlockUser = async (userId: string, userName: string) => {
    if (!currentUser) return;

    Alert.alert(
      "Block User",
      `Are you sure you want to block @${userName}? You won't see their messages anymore.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "users", currentUser.uid), {
                blockedUsers: arrayUnion(userId),
              });
            } catch (error) {
              console.error("Error blocking user:", error);
              Alert.alert("Error", "Failed to block user. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async (userId: string, userName: string) => {
    if (!currentUser) return;

    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock @${userName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "users", currentUser.uid), {
                blockedUsers: arrayRemove(userId),
              });
            } catch (error) {
              console.error("Error unblocking user:", error);
              Alert.alert("Error", "Failed to unblock user. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Open profile modal
  const openProfileModal = (userId: string) => {
    setSelectedUser(userCache[userId]);
    setProfileModalVisible(true);
  };

  // Handle report message
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
          currentUserData?.name ||
          currentUser.displayName ||
          currentUser.email?.split("@")[0] ||
          "Anonymous",
        reason: reason,
        timestamp: serverTimestamp(),
        campaignId: campaignId,
      };

      await addDoc(collection(db, "messageReports"), reportData);

      Alert.alert(
        "Report Submitted",
        "Thank you for reporting this message. Our team will review it shortly.",
        [{ text: "OK" }]
      );

      setReportModalVisible(false);
      setReportingMessage(null);
    } catch (error) {
      console.error("Error reporting message:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
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
    // Use screen-level currentUserData state to determine admin, not userCache
    const isCurrentUserAdmin =
      (currentUserData?.isAdmin || currentUserData?.role === "admin") ?? false;

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
                        {!isAdmin && user.isAmbassador && (
                          <Ionicons
                            name="star"
                            size={14}
                            color="#8B5CF6"
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
                {renderTextWithLinks(item.text, isMyMessage, item)}
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
                {/* Safety buttons first - Report and Block for other users' messages */}
                {!isMyMessage && (
                  <>
                    {/* Report button */}
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#FEF2F2",
                        borderRadius: 15,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        marginRight: 8,
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                      onPress={() => {
                        setReportingMessage(item);
                        setReportModalVisible(true);
                        setEmojiPickerVisible(false);
                        setEmojiPickerMessageId(null);
                      }}
                    >
                      <Ionicons name="flag" size={14} color="#DC2626" />
                      <Text
                        style={{
                          color: "#DC2626",
                          fontSize: 9,
                          fontWeight: "500",
                          marginTop: 2,
                        }}
                      >
                        Report
                      </Text>
                    </TouchableOpacity>

                    {/* Block button */}
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#FEF2F2",
                        borderRadius: 15,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        marginRight: 8,
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                      onPress={() => {
                        handleBlockUser(item.userId, item.userName);
                        setEmojiPickerVisible(false);
                        setEmojiPickerMessageId(null);
                      }}
                    >
                      <Ionicons name="ban" size={14} color="#DC2626" />
                      <Text
                        style={{
                          color: "#DC2626",
                          fontSize: 9,
                          fontWeight: "500",
                          marginTop: 2,
                        }}
                      >
                        Block
                      </Text>
                    </TouchableOpacity>

                    {/* Separator */}
                    <View
                      style={{
                        width: 1,
                        height: 24,
                        backgroundColor: "#E5E7EB",
                        marginRight: 8,
                      }}
                    />
                  </>
                )}

                {/* Reply button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: "#EFF6FF",
                    borderRadius: 11,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginRight: 8,
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                  onPress={() => {
                    setReplyingTo(item);
                    setEmojiPickerVisible(false);
                    setEmojiPickerMessageId(null);
                  }}
                >
                  <Ionicons name="arrow-undo" size={14} color="#3B82F6" />
                  <Text
                    style={{
                      color: "#3B82F6",
                      fontSize: 9,
                      fontWeight: "500",
                      marginTop: 2,
                    }}
                  >
                    Reply
                  </Text>
                </TouchableOpacity>

                {/* Separator */}
                <View
                  style={{
                    width: 1,
                    height: 24,
                    backgroundColor: "#E5E7EB",
                    marginRight: 8,
                  }}
                />

                {/* Emoji reactions - smaller and secondary */}
                {EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={{ marginHorizontal: 3 }}
                    onPress={() => handleReact(item.id, emoji)}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}

                {/* More emojis button - smaller */}
                <TouchableOpacity
                  style={{
                    marginLeft: 6,
                    marginRight: 2,
                    justifyContent: "center",
                    alignItems: "center",
                    width: 28,
                    height: 28,
                    backgroundColor: "#F3F4F6",
                    borderRadius: 14,
                  }}
                  onPress={() => {
                    // TODO: Add report functionality
                    Alert.alert("More Emojis", "More emojis coming soon");
                    setEmojiPickerVisible(false);
                    setEmojiPickerMessageId(null);
                  }}
                >
                  <Ionicons name="add" size={16} color="#6B7280" />
                </TouchableOpacity>

                {/* Admin delete button */}
                {isCurrentUserAdmin && (
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
              ListHeaderComponent={() =>
                hasMoreMessages ? (
                  <View className="py-4 px-4">
                    <TouchableOpacity
                      onPress={loadMoreMessages}
                      disabled={loadingMoreMessages}
                      className={`rounded-2xl py-3 px-4 flex-row items-center justify-center ${
                        loadingMoreMessages
                          ? "bg-gray-200"
                          : "bg-blue-50 border border-blue-200"
                      }`}
                    >
                      {loadingMoreMessages ? (
                        <>
                          <ActivityIndicator size="small" color="#6B7280" />
                          <Text className="ml-2 text-gray-500 font-gMedium">
                            Loading...
                          </Text>
                        </>
                      ) : (
                        <Text className="text-blue-600 font-gBold">
                          Load More Messages
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null
              }
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
              onScroll={handleScroll}
              scrollEventThrottle={16}
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

        {/* Mention Suggestions */}
        {showMentionSuggestions && (
          <View className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <Text className="text-xs text-gray-500 mb-2">Tap to mention:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-x-2">
                {mentionSuggestions.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    onPress={() => selectMention(user)}
                    className={`flex-row items-center rounded-full px-3 py-2 border ${
                      user.isEveryone
                        ? "bg-red-50 border-red-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <View className="w-6 h-6 rounded-full mr-2 overflow-hidden">
                      {user.isEveryone ? (
                        <View className="w-full h-full items-center justify-center bg-red-500">
                          <Text className="text-white font-gBold text-xs">
                            📢
                          </Text>
                        </View>
                      ) : user.photoUrl ? (
                        <Image
                          source={{ uri: user.photoUrl }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          className="w-full h-full items-center justify-center"
                          style={{ backgroundColor: getAvatarColor(user.id) }}
                        >
                          <Text className="text-white font-gBold text-xs">
                            {user.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      className={`text-sm ${
                        user.isEveryone
                          ? "font-gBold text-red-600"
                          : "font-gMedium text-gray-700"
                      }`}
                    >
                      {user.isEveryone ? "@everyone" : `@${user.name}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
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
                onChangeText={handleInputChange}
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
                      const isBlocked = blockedUsers.includes(item.id);
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
                              {!isAdmin && item.isAmbassador && (
                                <Ionicons
                                  name="star"
                                  size={16}
                                  color="#8B5CF6"
                                  style={{ marginLeft: 6 }}
                                />
                              )}
                              {isBlocked && (
                                <View className="ml-2 bg-red-100 px-2 py-1 rounded-full">
                                  <Text className="text-red-600 text-xs font-medium">
                                    Blocked
                                  </Text>
                                </View>
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
                          {item.id !== currentUser?.uid && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                if (isBlocked) {
                                  handleUnblockUser(item.id, item.name);
                                } else {
                                  handleBlockUser(item.id, item.name);
                                }
                              }}
                              className={`px-3 py-1 rounded-full ${
                                isBlocked ? "bg-green-100" : "bg-red-100"
                              }`}
                            >
                              <Text
                                className={`text-sm font-medium ${
                                  isBlocked ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {isBlocked ? "Unblock" : "Block"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}

                {/* Blocked Users Section */}
                {blockedUsers.length > 0 && (
                  <>
                    <View className="mt-6 mb-4">
                      <Text className="font-gBold text-lg text-gray-900">
                        Blocked Users ({blockedUsers.length})
                      </Text>
                    </View>
                    <FlatList
                      data={blockedUsers
                        .map((userId) => userCache[userId])
                        .filter(Boolean)}
                      keyExtractor={(item) => item.id || item.uid}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => (
                        <View className="flex-row items-center py-3 border-b border-gray-100">
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
                                  backgroundColor: getAvatarColor(
                                    item.id || item.uid
                                  ),
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
                            <Text className="font-gMedium text-base text-gray-900">
                              {item.name}
                            </Text>
                            {item.university && (
                              <Text
                                className="text-gray-500 text-sm"
                                numberOfLines={1}
                              >
                                {item.university}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() =>
                              handleUnblockUser(item.id || item.uid, item.name)
                            }
                            className="px-3 py-1 rounded-full bg-green-100"
                          >
                            <Text className="text-sm font-medium text-green-600">
                              Unblock
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                  </>
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
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {reportingMessage && (
                <View className="bg-gray-50 rounded-lg p-3 mb-4">
                  <Text className="text-sm font-medium text-gray-600 mb-1">
                    Message from @{reportingMessage.userName}:
                  </Text>
                  <Text className="text-gray-800" numberOfLines={3}>
                    {reportingMessage.text}
                  </Text>
                </View>
              )}

              <Text className="text-gray-700 mb-4">
                Why are you reporting this message?
              </Text>

              <ScrollView style={{ maxHeight: 300 }}>
                {REPORT_REASONS.map((reason, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleReportMessage(reason)}
                    className="flex-row items-center py-3 border-b border-gray-100"
                  >
                    <Ionicons name="flag-outline" size={20} color="#F59E0B" />
                    <Text className="ml-3 text-gray-800 font-medium">
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={() => {
                  setReportModalVisible(false);
                  setReportingMessage(null);
                }}
                className="bg-gray-200 rounded-xl py-3 items-center mt-4"
              >
                <Text className="text-gray-700 font-gBold text-base">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
          <View className="absolute bottom-24 right-4 z-10">
            <TouchableOpacity
              onPress={scrollToBottom}
              className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center shadow-lg"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <Ionicons name="chevron-down" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default CampaignChat;
