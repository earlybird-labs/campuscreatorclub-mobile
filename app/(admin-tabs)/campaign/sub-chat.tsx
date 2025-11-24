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
  Modal,
  ActivityIndicator,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
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
  writeBatch,
  startAfter,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import functions from "@react-native-firebase/functions";
import { Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
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

interface SubChat {
  id: string;
  name: string;
  description?: string;
  members: string[];
  createdBy: string;
  createdAt: any;
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

export default function AdminSubChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userCache, setUserCache] = useState<Record<string, any>>({});
  const [subChatInfo, setSubChatInfo] = useState<SubChat | null>(null);
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
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [adminBlockedUsers, setAdminBlockedUsers] = useState<string[]>([]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(
    null
  );

  // Add users modal states
  const [addUsersModalVisible, setAddUsersModalVisible] = useState(false);
  const [allAppUsers, setAllAppUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [subChatInfoModalVisible, setSubChatInfoModalVisible] = useState(false);

  // Add edit sub-chat states
  const [editSubChatModalVisible, setEditSubChatModalVisible] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  // Add @everyone functionality states
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);

  const [updating, setUpdating] = useState(false);

  // Pagination and scroll states
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [lastMessageDoc, setLastMessageDoc] = useState<any>(null);

  const db = getFirestore();
  const auth = getAuth();

  // Swipe-to-reply gesture refs
  const swipeStartXRef = useRef<number | null>(null);
  const swipeActiveMsgRef = useRef<string | null>(null);
  const swipeTriggeredRef = useRef<boolean>(false);

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
              setAdminBlockedUsers(userData.adminBlockedUsers || []);
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
            setAdminBlockedUsers(userData.adminBlockedUsers || []);
          }
        }
      });

      return () => unsubscribe();
    }
    setLoading(false);
  }, []);

  // Fetch sub-chat info
  useEffect(() => {
    if (!id) return;

    const fetchSubChatInfo = async () => {
      try {
        const subChatDoc = await getDoc(doc(db, "subChats", id as string));
        if (subChatDoc.exists()) {
          const data = subChatDoc.data();
          setSubChatInfo({
            id: subChatDoc.id,
            ...data,
          } as SubChat);
        }
      } catch (error) {
        console.error("Error fetching sub-chat info:", error);
      }
    };

    fetchSubChatInfo();
  }, [id]);

  // Listen for messages in real-time with pagination
  useEffect(() => {
    if (!id) return;

    const messagesRef = collection(db, "subChats", id as string, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(20));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messagesList: Message[] = [];
      const userIds = new Set<string>();
      let lastDoc = null;

      snapshot.forEach((docSnap, index) => {
        const messageData = docSnap.data();
        // Filter out messages from blocked users
        if (!blockedUsers.includes(messageData.userId)) {
          messagesList.push({
            id: docSnap.id,
            ...messageData,
          } as Message);
          userIds.add(messageData.userId);
        }
        // Set the last document for pagination
        if (index === snapshot.docs.length - 1) {
          lastDoc = docSnap;
        }
      });

      // Set pagination state
      setLastMessageDoc(lastDoc);
      setHasMoreMessages(snapshot.docs.length === 20);

      // Fetch user data for profile images
      const updatedUserCache = { ...userCache };
      let cacheUpdated = false;

      // Batch fetch user data for better performance
      const missingUserIds = Array.from(userIds).filter(
        (userId) => !updatedUserCache[userId]
      );

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
        userResults.forEach((result) => {
          if (result) {
            updatedUserCache[result.userId] = result.userData;
            cacheUpdated = true;
          }
        });
      }

      // Update cache only if new data was added
      if (cacheUpdated) {
        setUserCache(updatedUserCache);
      }

      // Add user photo URLs to messages
      const messagesWithPhotos = messagesList.map((message) => ({
        ...message,
        userPhotoUrl: updatedUserCache[message.userId]?.photoUrl,
      }));

      setMessages(messagesWithPhotos.reverse());
      setLoading(false);

      // Auto-scroll to bottom on initial load
      if (isInitialLoad && messagesWithPhotos.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
          setShowScrollToBottom(false);
          setIsInitialLoad(false);
        }, 300);
      }
    });

    return () => unsubscribe();
  }, [id, blockedUsers]);

  // Update messages when user cache changes
  useEffect(() => {
    if (messages.length > 0) {
      const updatedMessages = messages.map((message) => ({
        ...message,
        userPhotoUrl: userCache[message.userId]?.photoUrl,
      }));

      // Only update if there are actual changes
      const hasChanges = updatedMessages.some(
        (msg, index) => msg.userPhotoUrl !== messages[index].userPhotoUrl
      );

      if (hasChanges) {
        setMessages(updatedMessages);
      }
    }
  }, [userCache]);

  // Fetch all users in this subchat
  useEffect(() => {
    if (!subChatInfo?.members || subChatInfo.members.length === 0) {
      setAllUsers([]);
      return;
    }

    const fetchUsers = async () => {
      try {
        // Fetch all users and filter by members
        const usersQuery = query(collection(db, "users"));
        const usersSnapshot = await getDocs(usersQuery);

        const users: any[] = [];
        usersSnapshot.forEach((doc) => {
          // Only include users who are members of this subchat
          if (subChatInfo.members.includes(doc.id)) {
            users.push({
              id: doc.id,
              ...doc.data(),
            });
          }
        });

        // Sort users with admins first, then alphabetically
        users.sort((a, b) => {
          const aIsAdmin = a.isAdmin || a.role === "admin";
          const bIsAdmin = b.isAdmin || b.role === "admin";

          // If one is admin and other is not, admin comes first
          if (aIsAdmin && !bIsAdmin) return -1;
          if (!aIsAdmin && bIsAdmin) return 1;

          // If both are admin or both are not admin, sort alphabetically
          return (a.name || "").localeCompare(b.name || "");
        });
        setAllUsers(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        setAllUsers([]);
      }
    };

    fetchUsers();
  }, [subChatInfo?.members]);

  // Fetch all app users for adding to chat
  useEffect(() => {
    const q = query(collection(db, "users"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!querySnapshot) {
          setAllAppUsers([]);
          return;
        }

        const usersData: any[] = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          // Include all users except those already in the chat
          if (!subChatInfo?.members?.includes(doc.id)) {
            usersData.push({
              id: doc.id,
              name: userData.name || "Unknown",
              email: userData.email || "",
              photoUrl: userData.photoUrl,
              university: userData.university,
              isAdmin: userData.isAdmin || userData.role === "admin",
            });
          }
        });

        // Sort users alphabetically by name
        usersData.sort((a, b) => a.name.localeCompare(b.name));
        setAllAppUsers(usersData);
      },
      (error) => {
        console.error("Error fetching all users:", error);
        setAllAppUsers([]);
      }
    );

    return () => unsubscribe();
  }, [subChatInfo?.members]);

  // Listen for message reactions in real-time
  useEffect(() => {
    if (!id) return;

    const unsubscribes: (() => void)[] = [];
    messages.forEach((msg) => {
      const msgRef = doc(db, "subChats", id as string, "messages", msg.id);
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
  }, [messages, id]);

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
    if (!inputText.trim() || !currentUser || !id) return;

    try {
      const messageText = inputText.trim();

      // Check if message contains @everyone and user is admin
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

      // Add reply data if replying to a message
      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          userName: replyingTo.userName,
        };
      }

      // Add @everyone flag if present
      if (hasEveryoneMention) {
        messageData.everyoneMention = true;
      }

      await addDoc(
        collection(db, "subChats", id as string, "messages"),
        messageData
      );

      // Send @everyone notifications if applicable
      if (hasEveryoneMention && isCurrentUserAdmin) {
        await sendEveryoneNotifications(messageText);
      }

      setInputText("");
      setReplyingTo(null);
      setShowMentionSuggestions(false);

      // Scroll to bottom when user sends a message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
        setShowScrollToBottom(false);
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  // Send @everyone notifications using Cloud Function
  const sendEveryoneNotifications = async (
    messageText: string,
    messageId?: string
  ) => {
    try {
      // Call Cloud Function
      const sendEveryoneNotificationsFunction = functions().httpsCallable(
        "sendEveryoneNotifications"
      );

      const result = await sendEveryoneNotificationsFunction({
        messageText,
        chatType: "subchat",
        chatId: id,
        messageId: messageId || null,
      });
    } catch (error) {
      console.error("Error sending @everyone notifications:", error);
    }
  };

  // Handle @everyone mention suggestions
  const handleInputTextChange = (text: string) => {
    setInputText(text);

    // Check for @everyone mention
    const words = text.split(" ");
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      const queryText = lastWord.substring(1).toLowerCase();

      // Add @everyone suggestion for admins
      const isCurrentUserAdmin =
        currentUserData?.isAdmin || currentUserData?.role === "admin";

      if (isCurrentUserAdmin && "everyone".includes(queryText)) {
        setMentionSuggestions([
          {
            id: "everyone",
            name: "everyone",
            isEveryone: true,
          },
        ]);
        setShowMentionSuggestions(true);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (user: any) => {
    const words = inputText.split(" ");
    words[words.length - 1] = user.isEveryone
      ? "@everyone "
      : `@${user.name.toLowerCase().replace(/\s+/g, "")} `;
    setInputText(words.join(" "));
    setShowMentionSuggestions(false);
  };

  // Load more messages for pagination
  const loadMoreMessages = async () => {
    if (!hasMoreMessages || loadingMoreMessages || !lastMessageDoc || !id)
      return;

    setLoadingMoreMessages(true);
    try {
      const messagesRef = collection(db, "subChats", id as string, "messages");
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
        setMessages((prev) => [...messagesWithPhotos.reverse(), ...prev]);
        setLastMessageDoc(newLastDoc);
        setHasMoreMessages(snapshot.docs.length === 20);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  // Handle scroll to bottom
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

  // Handle message deletion
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
                doc(db, "subChats", id as string, "messages", messageId)
              );
            } catch (e) {
              Alert.alert("Error", "Failed to delete message.");
            }
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // If message is from today, show time only
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // If message is older, show date
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
    message: Message
  ) => {
    // Enhanced URL regex to catch more URL patterns
    const urlRegex =
      /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
    const mentionRegex = /(@\w+)/g;

    // Check if the message contains any URLs with enhanced detection
    const hasUrl = urlRegex.test(text);

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
                // Split by both URLs and mentions with enhanced regex
                const combinedRegex =
                  /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*|@\w+)/g;
                const parts = text.split(combinedRegex);

                return parts.map((part, index) => {
                  if (urlRegex.test(part)) {
                    // Ensure URL has protocol for opening
                    let urlToOpen = part;
                    if (
                      !part.startsWith("http://") &&
                      !part.startsWith("https://")
                    ) {
                      urlToOpen = `https://${part}`;
                    }

                    return (
                      <Text
                        key={index}
                        className={`${
                          isMyMessage ? "text-blue-200" : "text-blue-600"
                        } underline`}
                        onPress={() => {
                          Linking.openURL(urlToOpen).catch((err) =>
                            console.error("Failed to open URL:", err)
                          );
                        }}
                      >
                        {part}
                      </Text>
                    );
                  } else if (mentionRegex.test(part)) {
                    // Special styling for @everyone only if it's an admin message
                    if (part === "@everyone" && message.everyoneMention) {
                      return (
                        <Text
                          key={index}
                          className={`${
                            isMyMessage ? "text-red-200" : "text-red-600"
                          } font-bold`}
                        >
                          📢{part}
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
                    fontSize: 14,
                    fontWeight: "600",
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
                  onError={() => () => {}}
                />
              )}
              containerStyle={{
                padding: 12,
                borderRadius: 8,
                backgroundColor: isMyMessage
                  ? "rgba(255,255,255,0.1)"
                  : "#f9fafb",
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
            if (part === "@everyone" && message.everyoneMention) {
              return (
                <Text
                  key={index}
                  className={`${
                    isMyMessage ? "text-red-200" : "text-red-600"
                  } font-bold`}
                >
                  📢{part}
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
    if (!currentUser || !id) return;
    const msgRef = doc(db, "subChats", id as string, "messages", messageId);
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

  // Block user function
  const handleBlockUser = async (userId: string, userName: string) => {
    if (!currentUser || userId === currentUser.uid) return;

    Alert.alert(
      "Block User",
      `Are you sure you want to block @${userName}? This will block them for all users.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              // Check if current user is admin
              const isCurrentUserAdmin =
                currentUserData?.isAdmin || currentUserData?.role === "admin";

              if (isCurrentUserAdmin) {
                // Admin block: Add to all users' blocked lists EXCEPT the user being blocked
                const usersQuery = query(collection(db, "users"));
                const usersSnapshot = await getDocs(usersQuery);

                const batch = writeBatch(db);

                usersSnapshot.forEach((userDoc) => {
                  // Don't add the blocked user to their own blocked list
                  if (userDoc.id !== userId) {
                    const userRef = doc(db, "users", userDoc.id);
                    batch.update(userRef, {
                      blockedUsers: arrayUnion(userId),
                      adminBlockedUsers: arrayUnion(userId),
                    });
                  }
                });

                await batch.commit();

                Alert.alert(
                  "User Blocked Globally",
                  `@${userName} has been blocked for all users.`
                );
              } else {
                // Regular user block: Only add to current user's blocked list
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, {
                  blockedUsers: arrayUnion(userId),
                });

                Alert.alert("User Blocked", `@${userName} has been blocked.`);
              }
            } catch (error) {
              console.error("Error blocking user:", error);
              Alert.alert("Error", "Failed to block user. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Unblock user function
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
              const isAdminBlocked =
                currentUserData?.adminBlockedUsers?.includes(userId);
              const isCurrentUserAdmin =
                currentUserData?.isAdmin || currentUserData?.role === "admin";

              if (isAdminBlocked && isCurrentUserAdmin) {
                // Admin unblocking: Remove from all users' blocked lists EXCEPT the user being unblocked
                const usersQuery = query(collection(db, "users"));
                const usersSnapshot = await getDocs(usersQuery);

                const batch = writeBatch(db);

                usersSnapshot.forEach((userDoc) => {
                  // Don't remove the user from their own blocked list (they shouldn't be there anyway)
                  if (userDoc.id !== userId) {
                    const userRef = doc(db, "users", userDoc.id);
                    batch.update(userRef, {
                      blockedUsers: arrayRemove(userId),
                      adminBlockedUsers: arrayRemove(userId),
                    });
                  }
                });

                await batch.commit();

                Alert.alert(
                  "User Unblocked Globally",
                  `@${userName} has been unblocked for all users.`
                );
              } else if (!isAdminBlocked) {
                // Regular user unblock: Only remove from current user's blocked list
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, {
                  blockedUsers: arrayRemove(userId),
                });

                Alert.alert(
                  "User Unblocked",
                  `@${userName} has been unblocked.`
                );
              } else {
                // Non-admin trying to unblock admin-blocked user
                Alert.alert(
                  "Cannot Unblock",
                  "This user was blocked by an admin and can only be unblocked by an admin."
                );
                return;
              }
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
        subChatId: id,
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

  // Delete sub-chat function
  const handleDeleteSubChat = async () => {
    if (!id || !subChatInfo) return;

    Alert.alert(
      "Delete Sub-Chat",
      `Are you sure you want to delete "${subChatInfo.name}"? This will permanently delete all messages and cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all messages in the sub-chat first
              const messagesRef = collection(
                db,
                "subChats",
                id as string,
                "messages"
              );
              const messagesSnapshot = await getDocs(messagesRef);

              const batch = writeBatch(db);

              // Delete all messages
              messagesSnapshot.forEach((messageDoc) => {
                batch.delete(messageDoc.ref);
              });

              // Delete the sub-chat document itself
              batch.delete(doc(db, "subChats", id as string));

              await batch.commit();

              Alert.alert(
                "Sub-Chat Deleted",
                "The sub-chat and all its messages have been permanently deleted.",
                [
                  {
                    text: "OK",
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error) {
              console.error("Error deleting sub-chat:", error);
              Alert.alert(
                "Error",
                "Failed to delete sub-chat. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  // Add users to chat function
  const handleAddUsers = async () => {
    if (!id || !subChatInfo || selectedUsers.size === 0) return;

    setAdding(true);
    try {
      const newMembers = [...subChatInfo.members, ...Array.from(selectedUsers)];

      await updateDoc(doc(db, "subChats", id as string), {
        members: newMembers,
      });

      Alert.alert(
        "Success",
        `${selectedUsers.size} user${
          selectedUsers.size > 1 ? "s" : ""
        } added to the chat!`
      );

      setAddUsersModalVisible(false);
      setSelectedUsers(new Set());
      setSearchQuery("");
    } catch (error) {
      console.error("Error adding users:", error);
      Alert.alert("Error", "Failed to add users. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  // Update sub-chat details function
  const handleUpdateSubChat = async () => {
    if (!id || !subChatInfo || !editingName.trim()) return;

    setUpdating(true);
    try {
      await updateDoc(doc(db, "subChats", id as string), {
        name: editingName.trim(),
        description: editingDescription.trim(),
      });

      // Update local state
      setSubChatInfo({
        ...subChatInfo,
        name: editingName.trim(),
        description: editingDescription.trim(),
      });

      Alert.alert("Success", "Sub-chat details updated successfully!");
      setEditSubChatModalVisible(false);
    } catch (error) {
      console.error("Error updating sub-chat:", error);
      Alert.alert(
        "Error",
        "Failed to update sub-chat details. Please try again."
      );
    } finally {
      setUpdating(false);
    }
  };

  // Open edit modal with current data
  const openEditModal = () => {
    setEditingName(subChatInfo?.name || "");
    setEditingDescription(subChatInfo?.description || "");
    setEditSubChatModalVisible(true);
    setSubChatInfoModalVisible(false);
  };

  // Filter users based on search query
  const filteredUsers = allAppUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

    return (
      <View
        className={`mb-4 ${isMyMessage ? "items-end" : "items-start"}`}
        onTouchStart={(e) => {
          swipeStartXRef.current = e.nativeEvent.pageX;
          swipeActiveMsgRef.current = item.id;
          swipeTriggeredRef.current = false;
        }}
        onTouchMove={(e) => {
          if (
            swipeActiveMsgRef.current === item.id &&
            swipeStartXRef.current !== null &&
            !swipeTriggeredRef.current
          ) {
            const dx = e.nativeEvent.pageX - swipeStartXRef.current;
            if (Math.abs(dx) > 40) {
              setReplyingTo(item);
              swipeTriggeredRef.current = true;
            }
          }
        }}
        onTouchEnd={() => {
          swipeStartXRef.current = null;
          swipeActiveMsgRef.current = null;
          swipeTriggeredRef.current = false;
        }}
        onTouchCancel={() => {
          swipeStartXRef.current = null;
          swipeActiveMsgRef.current = null;
          swipeTriggeredRef.current = false;
        }}
      >
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
                    // TODO: Add more emojis functionality
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

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="chatbubbles-outline" size={64} color="#9CA3AF" />
          <Text className="text-gray-500 text-lg font-medium mt-4">
            Please sign in to join the chat
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            You need to be logged in to send and receive messages
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
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            {/* <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
              <Ionicons name="chatbubbles" size={20} color="#3B82F6" />
            </View> */}
            <TouchableOpacity
              className="flex-1"
              onPress={() => setSubChatInfoModalVisible(true)}
            >
              <Text className="font-gBold text-lg text-gray-900">
                {subChatInfo?.name || "Group Chat"}
              </Text>
              {subChatInfo?.description && (
                <Text className="text-gray-500 text-sm" numberOfLines={1}>
                  {subChatInfo.description}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center">
            {/* Delete sub-chat button (Admin only) */}
            {(currentUserData?.isAdmin ||
              currentUserData?.role === "admin") && (
              <TouchableOpacity
                onPress={handleDeleteSubChat}
                className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-2"
              >
                <Ionicons name="trash" size={20} color="#DC2626" />
              </TouchableOpacity>
            )}

            {/* Add users button (Admin only) */}
            {(currentUserData?.isAdmin ||
              currentUserData?.role === "admin") && (
              <TouchableOpacity
                onPress={() => setAddUsersModalVisible(true)}
                className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-2"
              >
                <Ionicons name="person-add" size={20} color="#16A34A" />
              </TouchableOpacity>
            )}

            {/* Member count badge */}
            <TouchableOpacity
              className="flex-row items-center border border-gray-200 rounded-full px-4 py-1"
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
                {subChatInfo?.members?.length || 0}
              </Text>
            </TouchableOpacity>
          </View>
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
                          <Text className="ml-2 text-gray-600 font-gMedium">
                            Loading...
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons
                            name="chevron-up"
                            size={20}
                            color="#3B82F6"
                          />
                          <Text className="ml-2 text-blue-600 font-gMedium">
                            Load older messages
                          </Text>
                        </>
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

        {/* Mention Suggestions */}
        {showMentionSuggestions && (
          <View className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-x-2">
                {mentionSuggestions.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    onPress={() => handleMentionSelect(user)}
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
                      className={`font-gMedium text-sm ${
                        user.isEveryone ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {user.name}
                      {user.isEveryone}
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
                onChangeText={handleInputTextChange}
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
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl" style={{ height: "75%" }}>
              <View className="bg-white rounded-t-3xl p-6">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="font-gBold text-xl text-gray-900">
                    Chat Members ({allUsers.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => setUsersListVisible(false)}
                    className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center"
                  >
                    <Ionicons name="close" size={18} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Scrollable content with sections */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                >
                  {/* Admins Section */}
                  {allUsers.filter(
                    (user) => user.isAdmin || user.role === "admin"
                  ).length > 0 && (
                    <View className="mt-4 mb-6">
                      <Text className="font-gBold text-lg text-gray-900 mb-3">
                        Admins
                      </Text>
                      {allUsers
                        .filter((user) => user.isAdmin || user.role === "admin")
                        .sort((a, b) =>
                          (a.name || "").localeCompare(b.name || "")
                        )
                        .map((item) => (
                          <View
                            key={item.id}
                            className="flex-row items-center py-3 border-b border-gray-100"
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
                                  {item.id === currentUser?.uid && " (You)"}
                                </Text>
                                <Ionicons
                                  name="star"
                                  size={16}
                                  color="#FCD34D"
                                  style={{ marginLeft: 6 }}
                                />
                              </View>
                              {item.university && (
                                <Text className="font-gRegular text-sm text-gray-500 mt-1">
                                  {item.university}
                                </Text>
                              )}
                            </View>
                          </View>
                        ))}
                    </View>
                  )}

                  {/* Current User Section (if not admin) */}
                  {currentUser &&
                    !allUsers.find(
                      (user) =>
                        user.id === currentUser.uid &&
                        (user.isAdmin || user.role === "admin")
                    ) && (
                      <View className="mb-6">
                        <Text className="font-gBold text-lg text-gray-900 mb-3">
                          You
                        </Text>
                        {allUsers
                          .filter((user) => user.id === currentUser.uid)
                          .map((item) => (
                            <View
                              key={item.id}
                              className="flex-row items-center py-3 border-b border-gray-100"
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
                                    {item.name} (You)
                                  </Text>
                                </View>
                                {item.university && (
                                  <Text className="font-gRegular text-sm text-gray-500 mt-1">
                                    {item.university}
                                  </Text>
                                )}
                              </View>
                            </View>
                          ))}
                      </View>
                    )}

                  {/* Blocked Users Section */}
                  {allUsers.filter((user) => blockedUsers.includes(user.id))
                    .length > 0 && (
                    <View className="mb-6">
                      <Text className="font-gBold text-lg text-gray-900 mb-3">
                        Blocked Users
                      </Text>
                      {allUsers
                        .filter((user) => blockedUsers.includes(user.id))
                        .sort((a, b) =>
                          (a.name || "").localeCompare(b.name || "")
                        )
                        .map((item) => (
                          <View
                            key={item.id}
                            className="flex-row items-center py-3 border-b border-gray-100"
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
                                <View className="ml-2 bg-red-100 px-2 py-1 rounded-full">
                                  <Text className="text-red-600 text-xs font-medium">
                                    Blocked
                                  </Text>
                                </View>
                              </View>
                              {item.university && (
                                <Text className="font-gRegular text-sm text-gray-500 mt-1">
                                  {item.university}
                                </Text>
                              )}
                            </View>
                            <TouchableOpacity
                              onPress={() =>
                                handleUnblockUser(item.id, item.name)
                              }
                              className="px-3 py-1 rounded-full bg-green-100"
                            >
                              <Text className="text-sm font-medium text-green-600">
                                Unblock
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                    </View>
                  )}

                  {/* Members Section */}
                  {allUsers.filter(
                    (user) =>
                      !(user.isAdmin || user.role === "admin") &&
                      user.id !== currentUser?.uid &&
                      !blockedUsers.includes(user.id)
                  ).length > 0 && (
                    <View className="mb-6">
                      <Text className="font-gBold text-lg text-gray-900 mb-3">
                        Members
                      </Text>
                      {allUsers
                        .filter(
                          (user) =>
                            !(user.isAdmin || user.role === "admin") &&
                            user.id !== currentUser?.uid &&
                            !blockedUsers.includes(user.id)
                        )
                        .sort((a, b) =>
                          (a.name || "").localeCompare(b.name || "")
                        )
                        .map((item) => (
                          <View
                            key={item.id}
                            className="flex-row items-center py-3 border-b border-gray-100"
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
                              </View>
                              {item.university && (
                                <Text className="font-gRegular text-sm text-gray-500 mt-1">
                                  {item.university}
                                </Text>
                              )}
                            </View>
                          </View>
                        ))}
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>
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

        {/* Add Users Modal */}
        <Modal
          visible={addUsersModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setAddUsersModalVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-5/6">
              {/* Header */}
              <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                <Text className="text-2xl font-bold text-gray-900">
                  Add Users to Chat
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setAddUsersModalVisible(false);
                    setSelectedUsers(new Set());
                    setSearchQuery("");
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                className="flex-1 px-6 py-4"
                showsVerticalScrollIndicator={false}
              >
                {/* User Search */}
                <View className="mb-4">
                  <Text className="text-gray-600 text-base mb-2">
                    Search Users
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#9CA3AF"
                  />

                  {/* Select/Deselect All Users Buttons */}
                  <View className="flex-row gap-x-3 mb-4">
                    <TouchableOpacity
                      onPress={() => {
                        const allUserIds = new Set(
                          filteredUsers.map((user) => user.id)
                        );
                        setSelectedUsers(allUserIds);
                      }}
                      className="flex-1 bg-blue-500 rounded-xl py-3 px-4 flex-row items-center justify-center"
                    >
                      <Ionicons
                        name="people"
                        size={20}
                        color="white"
                        style={{ marginRight: 8 }}
                      />
                      <Text className="text-white font-semibold text-base">
                        Select All ({filteredUsers.length})
                      </Text>
                    </TouchableOpacity>

                    {selectedUsers.size > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedUsers(new Set());
                        }}
                        className="flex-1 bg-gray-500 rounded-xl py-3 px-4 flex-row items-center justify-center"
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="white"
                          style={{ marginRight: 8 }}
                        />
                        <Text className="text-white font-semibold text-base">
                          Deselect All
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Selected Users Count */}
                {selectedUsers.size > 0 && (
                  <View className="mb-4 p-3 bg-blue-50 rounded-xl">
                    <Text className="text-blue-700 font-gMedium">
                      {selectedUsers.size} user
                      {selectedUsers.size > 1 ? "s" : ""} selected
                    </Text>
                  </View>
                )}

                {/* Users List */}
                <View className="mb-6">
                  {filteredUsers.length === 0 ? (
                    <View className="py-8 items-center">
                      <Ionicons
                        name="people-outline"
                        size={48}
                        color="#9CA3AF"
                      />
                      <Text className="text-gray-500 text-center mt-2">
                        {allAppUsers.length === 0
                          ? "All users are already in this chat"
                          : "No users found"}
                      </Text>
                    </View>
                  ) : (
                    filteredUsers.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        className={`flex-row items-center p-3 rounded-xl mb-2 ${
                          selectedUsers.has(user.id)
                            ? "bg-blue-100"
                            : "bg-gray-50"
                        }`}
                        onPress={() => toggleUserSelection(user.id)}
                      >
                        <View className="w-10 h-10 rounded-full overflow-hidden mr-3">
                          {user.photoUrl ? (
                            <Image
                              source={{ uri: user.photoUrl }}
                              style={{ width: "100%", height: "100%" }}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              className="w-full h-full items-center justify-center"
                              style={{
                                backgroundColor: getAvatarColor(user.id),
                              }}
                            >
                              <Text className="text-white font-gBold text-sm">
                                {user.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text className="font-gMedium text-gray-900">
                              {user.name}
                            </Text>
                            {user.isAdmin && (
                              <Ionicons
                                name="star"
                                size={14}
                                color="#FCD34D"
                                style={{ marginLeft: 6 }}
                              />
                            )}
                          </View>
                          <Text className="text-gray-500 text-sm">
                            {user.university || user.email}
                          </Text>
                        </View>
                        {selectedUsers.has(user.id) && (
                          <Ionicons
                            name="checkmark-circle"
                            size={24}
                            color="#3B82F6"
                          />
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </ScrollView>

              {/* Add Users Button */}
              <View className="p-6 border-t border-gray-100">
                <TouchableOpacity
                  onPress={handleAddUsers}
                  disabled={adding || selectedUsers.size === 0}
                  className={`rounded-2xl py-4 items-center justify-center ${
                    adding || selectedUsers.size === 0
                      ? "bg-gray-300"
                      : "bg-green-500"
                  }`}
                >
                  {adding ? (
                    <Text className="text-white text-lg font-semibold">
                      Adding Users...
                    </Text>
                  ) : (
                    <Text className="text-white text-lg font-semibold">
                      Add {selectedUsers.size} User
                      {selectedUsers.size !== 1 ? "s" : ""} to Chat
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Sub-Chat Info Modal */}
        <Modal
          visible={subChatInfoModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSubChatInfoModalVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-center items-center">
            <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-gray-900">
                  Chat Information
                </Text>
                <TouchableOpacity
                  onPress={() => setSubChatInfoModalVisible(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-600 mb-2">
                  Chat Name
                </Text>
                <Text className="text-lg font-bold text-gray-900">
                  {subChatInfo?.name || "Group Chat"}
                </Text>
              </View>

              {subChatInfo?.description && (
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-600 mb-2">
                    Description
                  </Text>
                  <ScrollView style={{ maxHeight: 200 }}>
                    <Text className="text-gray-800 leading-5">
                      {subChatInfo.description}
                    </Text>
                  </ScrollView>
                </View>
              )}

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-600 mb-2">
                  Members
                </Text>
                <Text className="text-gray-800">
                  {subChatInfo?.members?.length || 0} member
                  {(subChatInfo?.members?.length || 0) !== 1 ? "s" : ""}
                </Text>
              </View>

              {/* Edit button for admins */}
              {(currentUserData?.isAdmin ||
                currentUserData?.role === "admin") && (
                <TouchableOpacity
                  onPress={openEditModal}
                  className="bg-green-500 rounded-xl py-3 items-center mb-3"
                >
                  <Text className="text-white font-gBold text-base">
                    Edit Chat Details
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setSubChatInfoModalVisible(false)}
                className="bg-blue-500 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-gBold text-base">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit Sub-Chat Modal */}
        <Modal
          visible={editSubChatModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setEditSubChatModalVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-center items-center">
            <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-gray-900">
                  Edit Chat Details
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditSubChatModalVisible(false);
                    setEditingName("");
                    setEditingDescription("");
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                {/* Chat Name Input */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-600 mb-2">
                    Chat Name <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                    placeholder="Enter chat name..."
                    value={editingName}
                    onChangeText={setEditingName}
                    placeholderTextColor="#9CA3AF"
                    maxLength={50}
                  />
                  <Text className="text-xs text-gray-500 mt-1">
                    {editingName.length}/50 characters
                  </Text>
                </View>

                {/* Description Input */}
                <View className="mb-6">
                  <Text className="text-sm font-medium text-gray-600 mb-2">
                    Description (Optional)
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                    placeholder="Enter chat description..."
                    value={editingDescription}
                    onChangeText={setEditingDescription}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    maxLength={200}
                    style={{ minHeight: 100 }}
                  />
                  <Text className="text-xs text-gray-500 mt-1">
                    {editingDescription.length}/200 characters
                  </Text>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View className="flex-row gap-x-3">
                <TouchableOpacity
                  onPress={() => {
                    setEditSubChatModalVisible(false);
                    setEditingName("");
                    setEditingDescription("");
                  }}
                  className="flex-1 bg-gray-200 rounded-xl py-3 items-center"
                >
                  <Text className="text-gray-700 font-gBold text-base">
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUpdateSubChat}
                  disabled={updating || !editingName.trim()}
                  className={`flex-1 rounded-xl py-3 items-center ${
                    updating || !editingName.trim()
                      ? "bg-gray-300"
                      : "bg-green-500"
                  }`}
                >
                  {updating ? (
                    <Text className="text-white font-gBold text-base">
                      Updating...
                    </Text>
                  ) : (
                    <Text className="text-white font-gBold text-base">
                      Update Chat
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
