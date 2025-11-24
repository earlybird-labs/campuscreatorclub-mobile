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
// import { SafeAreaView } from "react-native-safe-area-context";
import { Entypo, Ionicons, AntDesign } from "@expo/vector-icons";
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
  where,
  setDoc,
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
import { router } from "expo-router";
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
  createdBy: string;
  members: string[];
  createdAt: any;
}

interface Campaign {
  id: string;
  title: string;
  date: any;
  type: string;
  paymentType?: string;
  amount?: string;
  content: string;
  link: string;
  photoUrl?: string;
  brandColor?: string;
  createdAt: any;
  applied?: string[];
  approved?: string[];
  rejected?: string[];
  status?: "active" | "completed";
}

interface ChatItem {
  id: string;
  name: string;
  description?: string;
  type: "subchat" | "campaign";
  members?: string[];
  createdAt: any;
  photoUrl?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  university?: string;
}

const EMOJIS = ["🤖", "😎", "😂", "❤️", "🙌"];
const EXTENDED_EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😇",
  "🙂",
  "🙃",
  "😉",
  "😌",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😙",
  "😚",
  "😋",
  "😛",
  "😝",
  "😜",
  "🤪",
  "🤨",
  "🧐",
  "🤓",
  "😎",
  "🤩",
  "🥳",
  "😏",
  "😒",
  "😞",
  "😔",
  "😟",
  "😕",
  "🙁",
  "☹️",
  "😣",
  "😖",
  "😫",
  "😩",
  "🥺",
  "😢",
  "😭",
  "😤",
  "😠",
  "😡",
  "🤬",
  "🤯",
  "😳",
  "🥵",
  "🥶",
  "😱",
  "😨",
  "😰",
  "😥",
  "😓",
  "🤗",
  "🤔",
  "🤭",
  "🤫",
  "🤥",
  "😶",
  "😐",
  "😑",
  "😬",
  "🙄",
  "😯",
  "😦",
  "😧",
  "😮",
  "😲",
  "🥱",
  "😴",
  "🤤",
  "😪",
  "😵",
  "🤐",
  "🥴",
  "🤢",
  "🤮",
  "🤧",
  "😷",
  "🤒",
  "🤕",
  "🤑",
  "🤠",
  "😈",
  "👿",
  "👹",
  "👺",
  "🤡",
  "💩",
  "👻",
  "💀",
  "☠️",
  "👽",
  "👾",
  "🤖",
  "🎃",
  "😺",
  "😸",
  "😹",
  "😻",
  "😼",
  "😽",
  "🙀",
  "😿",
  "😾",
  "👋",
  "🤚",
  "🖐️",
  "✋",
  "🖖",
  "👌",
  "🤏",
  "✌️",
  "🤞",
  "🤟",
  "🤘",
  "🤙",
  "👈",
  "👉",
  "👆",
  "🖕",
  "👇",
  "☝️",
  "👍",
  "👎",
  "👊",
  "✊",
  "🤛",
  "🤜",
  "👏",
  "🙌",
  "👐",
  "🤲",
  "🤝",
  "🙏",
  "✍️",
  "💅",
  "🤳",
  "💪",
  "🦾",
  "🦿",
  "🦵",
  "🦶",
  "👂",
  "🦻",
  "👃",
  "🧠",
  "🫀",
  "🫁",
  "🦷",
  "🦴",
  "👀",
  "👁️",
  "👅",
  "👄",
  "💋",
  "🩸",
  "👶",
  "🧒",
  "👦",
  "👧",
  "🧑",
  "👱",
  "👨",
  "🧔",
  "👩",
  "🧓",
  "👴",
  "👵",
  "🙍",
  "🙎",
  "🙅",
  "🙆",
  "💁",
  "🙋",
  "🧏",
  "🙇",
  "🤦",
  "🤷",
  "👮",
  "🕵️",
  "💂",
  "🥷",
  "👷",
  "🤴",
  "👸",
  "👳",
  "👲",
  "🧕",
  "🤵",
  "👰",
  "🤰",
  "🤱",
  "👼",
  "🎅",
  "🤶",
  "🦸",
  "🦹",
  "🧙",
  "🧚",
  "🧛",
  "🧜",
  "🧝",
  "🧞",
  "🧟",
  "💆",
  "💇",
  "🚶",
  "🧍",
  "🧎",
  "🏃",
  "💃",
  "🕺",
  "🕴️",
  "👯",
  "🧖",
  "🧗",
  "🤺",
  "🏇",
  "⛷️",
  "🏂",
  "🏌️",
  "🏄",
  "🚣",
  "🏊",
  "⛹️",
  "🏋️",
  "🚴",
  "🚵",
  "🤸",
  "🤼",
  "🤽",
  "🤾",
  "🤹",
  "🧘",
  "🛀",
  "🛌",
  "🕯️",
  "💝",
  "🎁",
  "🎉",
  "🎊",
  "🎈",
  "🎀",
  "🎂",
  "🍰",
  "🧁",
  "🍭",
  "🍬",
  "🍫",
  "🍩",
  "🍪",
  "🎃",
  "🎄",
  "🎆",
  "🎇",
  "🧨",
  "✨",
  "🎋",
  "🎍",
  "🎎",
  "🎏",
  "🎐",
  "🎑",
  "🧧",
  "🎀",
  "🎁",
  "🎗️",
  "🎟️",
  "🎫",
  "🎖️",
  "🏆",
  "🏅",
  "🥇",
  "🥈",
  "🥉",
  "⚽",
  "⚾",
  "🥎",
  "🏀",
  "🏐",
  "🏈",
  "🏉",
  "🎾",
  "🥏",
  "🎳",
  "🏏",
  "🏑",
  "🏒",
  "🥍",
  "🏓",
  "🏸",
  "🥊",
  "🥋",
  "🥅",
  "⛳",
  "⛸️",
  "🎣",
  "🤿",
  "🎽",
  "🎿",
  "🛷",
  "🥌",
  "🎯",
];

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

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [userCache, setUserCache] = useState<Record<string, any>>({});
  const [userCount, setUserCount] = useState(0);
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
  const [customEmojiPickerVisible, setCustomEmojiPickerVisible] =
    useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [usersListVisible, setUsersListVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [subChatsModalVisible, setSubChatsModalVisible] = useState(false);
  const [createChatModalVisible, setCreateChatModalVisible] = useState(false);
  const [allChats, setAllChats] = useState<ChatItem[]>([]);
  const [subChats, setSubChats] = useState<SubChat[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allAppUsers, setAllAppUsers] = useState<any[]>([]);

  // Create chat state variables
  const [users, setUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [chatName, setChatName] = useState("");
  const [chatDescription, setChatDescription] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // New state for reporting and blocking
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(
    null
  );
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [adminBlockedUsers, setAdminBlockedUsers] = useState<string[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  // Pagination state
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [lastMessageDoc, setLastMessageDoc] = useState<any>(null);

  const db = getFirestore();
  const auth = getAuth();
  // Swipe-to-reply gesture refs
  const swipeStartXRef = useRef<number | null>(null);
  const swipeActiveMsgRef = useRef<string | null>(null);
  const swipeTriggeredRef = useRef<boolean>(false);

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
              setAdminBlockedUsers(userData.adminBlockedUsers || []);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
        // Only set loading to false after user data is fetched
        setLoading(false);
      };
      fetchUserData();
    } else {
      setLoading(false);
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
          setAdminBlockedUsers(userData.adminBlockedUsers || []);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch all sub-chats (real-time) - admins can see all sub-chats
  useEffect(() => {
    if (!currentUser) {
      setSubChats([]);
      return;
    }

    const q = query(collection(db, "subChats"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!querySnapshot) {
          console.log("SubChats QuerySnapshot is null");
          setSubChats([]);
          return;
        }

        const chatsData: SubChat[] = [];
        querySnapshot.forEach((doc) => {
          chatsData.push({
            id: doc.id,
            ...doc.data(),
          } as SubChat);
        });

        // Sort by creation date (newest first)
        chatsData.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.seconds - a.createdAt.seconds;
        });

        setSubChats(chatsData);
      },
      (error) => {
        console.error("Error fetching sub-chats:", error);
        setSubChats([]);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch all campaigns (real-time) - admin can see all campaigns
  useEffect(() => {
    const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const campaignsData: Campaign[] = [];
      querySnapshot.forEach((doc) => {
        campaignsData.push({
          id: doc.id,
          ...doc.data(),
        } as Campaign);
      });
      setCampaigns(campaignsData);
    });

    return () => unsubscribe();
  }, []);

  // Combine sub-chats and campaigns for admin view
  useEffect(() => {
    if (!currentUser) {
      setAllChats([]);
      return;
    }

    const chatItems: ChatItem[] = [];

    // Add sub-chats created by admin
    subChats.forEach((subChat) => {
      chatItems.push({
        id: subChat.id,
        name: subChat.name,
        description: subChat.description,
        type: "subchat",
        members: subChat.members,
        createdAt: subChat.createdAt,
      });
    });

    // Add all campaigns (admin can see all campaigns)
    campaigns.forEach((campaign) => {
      chatItems.push({
        id: campaign.id,
        name: campaign.title,
        description: campaign.content,
        type: "campaign",
        members: [
          ...(campaign.applied || []),
          ...(campaign.approved || []),
          ...(campaign.rejected || []),
        ],
        createdAt: campaign.createdAt,
        photoUrl: campaign.photoUrl,
      });
    });

    // Sort by creation date (newest first)
    chatItems.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.seconds - a.createdAt.seconds;
    });

    setAllChats(chatItems);
  }, [subChats, campaigns, currentUser]);

  // Listen for messages in real-time
  useEffect(() => {
    if (!currentUser) return;

    const messagesRef = collection(db, "globalChat");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(20));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList: Message[] = [];
      let lastDoc = null;

      snapshot.forEach((docSnap, index) => {
        const messageData = docSnap.data();
        // Filter out messages from blocked users
        if (!blockedUsers.includes(messageData.userId)) {
          messagesList.push({
            id: docSnap.id,
            ...messageData,
          } as Message);
        }
        // Set the last document for pagination
        if (index === snapshot.docs.length - 1) {
          lastDoc = docSnap;
        }
      });

      // Remove duplicates based on message ID
      const uniqueMessages = messagesList.filter(
        (message, index, self) =>
          index === self.findIndex((m) => m.id === message.id)
      );

      setMessages(uniqueMessages.reverse());
      setLastMessageDoc(lastDoc);
      setHasMoreMessages(snapshot.docs.length === 20); // If we got less than 20, no more messages
      setMessagesLoading(false);

      // Fetch user data for messages
      const userIds = [...new Set(uniqueMessages.map((msg) => msg.userId))];
      userIds.forEach(async (userId) => {
        if (!userCache[userId]) {
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setUserCache((prev) => ({
                ...prev,
                [userId]: userData,
              }));
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
          }
        }
      });

      // Auto-scroll to bottom on initial load
      if (isInitialLoad && uniqueMessages.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
          setIsInitialLoad(false);
        }, 300);
      }
    });

    return () => unsubscribe();
  }, [currentUser, blockedUsers]);

  // Listen for message reactions in real-time
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    messages.forEach((msg) => {
      const msgRef = doc(db, "globalChat", msg.id);
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

  // Listen for pinned message
  useEffect(() => {
    const pinnedRef = doc(db, "globalChatSettings", "pinned");
    const unsubscribe = onSnapshot(pinnedRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.messageId) {
          // Find the pinned message in current messages
          const pinned = messages.find((msg) => msg.id === data.messageId);
          if (pinned) {
            setPinnedMessage(pinned);
          } else {
            // If not in current messages, fetch it directly
            getDoc(doc(db, "globalChat", data.messageId)).then((msgDoc) => {
              if (msgDoc.exists()) {
                setPinnedMessage({
                  id: msgDoc.id,
                  ...msgDoc.data(),
                } as Message);
              }
            });
          }
        } else {
          setPinnedMessage(null);
        }
      } else {
        setPinnedMessage(null);
      }
    });
    return () => unsubscribe();
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

  // Fetch all users for group creation and for displaying all app users
  useEffect(() => {
    const q = query(collection(db, "users"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!querySnapshot) {
          console.log("Users QuerySnapshot is null");
          setUsers([]);
          setAllAppUsers([]);
          return;
        }

        const usersData: User[] = [];
        const allUsersData: any[] = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          // For allAppUsers, include all users
          allUsersData.push({
            id: doc.id,
            name: userData.name || "Unknown",
            email: userData.email || "",
            photoUrl: userData.photoUrl,
            university: userData.university,
            isAdmin: userData.isAdmin || userData.role === "admin",
            tiktok: userData.tiktok,
            instagram: userData.instagram,
            blockedUsers: userData.blockedUsers || [],
            adminBlockedUsers: userData.adminBlockedUsers || [],
            expoPushToken: userData.expoPushToken,
          });

          // Don't include current user in the list for group creation
          if (doc.id !== currentUser?.uid) {
            usersData.push({
              id: doc.id,
              name: userData.name || "Unknown",
              email: userData.email || "",
              photoUrl: userData.photoUrl,
              university: userData.university,
            });
          }
        });

        // Sort users alphabetically by name
        usersData.sort((a, b) => a.name.localeCompare(b.name));
        allUsersData.sort((a, b) => a.name.localeCompare(b.name));

        setUsers(usersData);
        setAllAppUsers(allUsersData);
        setUserCount(allUsersData.length);
      },
      (error) => {
        console.error("Error fetching users:", error);
        setUsers([]);
        setAllAppUsers([]);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUser) return;

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

      // Extract mentions from the message
      const mentionRegex = /@(\w+)/g;
      const mentions = [];
      let match;

      while ((match = mentionRegex.exec(messageText)) !== null) {
        const mentionedUsername = match[1].toLowerCase();

        // Skip @everyone as it's handled separately
        if (mentionedUsername === "everyone") {
          continue;
        }

        // Find user by name (case insensitive)
        const mentionedUser = allAppUsers.find(
          (user) =>
            user.name.toLowerCase().replace(/\s+/g, "") === mentionedUsername
        );
        if (mentionedUser && mentionedUser.id !== currentUser.uid) {
          const mentionData: any = {
            userId: mentionedUser.id,
            userName: mentionedUser.name,
          };

          // Only include expoPushToken if it exists
          if (mentionedUser.expoPushToken) {
            mentionData.expoPushToken = mentionedUser.expoPushToken;
          }

          mentions.push(mentionData);
        }
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

      // Add @everyone flag if present
      if (hasEveryoneMention) {
        messageData.everyoneMention = true;
      }

      // Only add mentions field if there are mentions
      if (mentions.length > 0) {
        messageData.mentions = mentions;
      }

      // Add reply data if replying to a message
      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          userName: replyingTo.userName,
        };
      }

      await addDoc(collection(db, "globalChat"), messageData);

      // Send push notifications to mentioned users
      if (mentions.length > 0) {
        await sendMentionNotifications(mentions, messageText);
      }

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

  // Send push notifications to mentioned users
  const sendMentionNotifications = async (
    mentions: any[],
    messageText: string
  ) => {
    try {
      const senderName =
        currentUserData?.name || currentUser?.displayName || "Someone";

      for (const mention of mentions) {
        if (mention.expoPushToken) {
          const notificationData = {
            to: mention.expoPushToken,
            sound: "default",
            title: `${senderName} mentioned you`,
            body:
              messageText.length > 100
                ? `${messageText.substring(0, 100)}...`
                : messageText,
            data: {
              type: "mention",
              senderId: currentUser?.uid,
              senderName: senderName,
              chatType: "global",
            },
          };

          // Send notification via Expo Push API
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(notificationData),
          });
        }
      }
    } catch (error) {
      console.error("Error sending mention notifications:", error);
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
        chatType: "global",
        chatId: null,
        messageId: messageId || null,
      });
    } catch (error) {
      console.error("Error sending @everyone notifications:", error);
    }
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
        // Show suggestions for users whose names match the query
        const userSuggestions = allAppUsers
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
            photoUrl: null,
          });
        }

        setMentionSuggestions(suggestions);
        setMentionQuery(queryText);
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

  // Load more messages for pagination
  const loadMoreMessages = async () => {
    if (!hasMoreMessages || loadingMoreMessages || !lastMessageDoc) return;

    setLoadingMoreMessages(true);
    try {
      const messagesRef = collection(db, "globalChat");
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
        // Fetch user data for new messages
        const userIds = [...new Set(newMessages.map((msg) => msg.userId))];
        userIds.forEach(async (userId) => {
          if (!userCache[userId]) {
            try {
              const userDoc = await getDoc(doc(db, "users", userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                setUserCache((prev) => ({
                  ...prev,
                  [userId]: userData,
                }));
              }
            } catch (error) {
              console.error("Error fetching user data:", error);
            }
          }
        });

        // Combine with existing messages, ensuring no duplicates
        setMessages((prevMessages) => {
          const combinedMessages = [...newMessages.reverse(), ...prevMessages];
          // Remove duplicates based on message ID
          const uniqueMessages = combinedMessages.filter(
            (message, index, self) =>
              index === self.findIndex((m) => m.id === message.id)
          );
          return uniqueMessages;
        });
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
    message?: Message
  ) => {
    // Enhanced URL detection regex that handles various URL formats
    const urlRegex =
      /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})([\/\w\-\._~:?#[\]@!$&'()*+,;=]*)?)/gi;
    const mentionRegex = /(@\w+)/g;
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;

    // Enhanced URL detection function
    const isUrl = (str: string) => {
      const patterns = [
        /^https?:\/\//i,
        /^www\./i,
        /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})/i,
      ];
      return patterns.some((pattern) => pattern.test(str));
    };

    // Function to normalize URLs for opening
    const normalizeUrl = (url: string) => {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }
      if (url.startsWith("www.")) {
        return `https://${url}`;
      }
      // For domain-only URLs, add https://
      if (isUrl(url)) {
        return `https://${url}`;
      }
      return url;
    };

    // Check if the message contains any URLs
    const hasUrl = urlRegex.test(text) || emailRegex.test(text);

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
                // Combined regex for URLs, emails, and mentions
                const combinedRegex =
                  /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})([\/\w\-\._~:?#[\]@!$&'()*+,;=]*)?|[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+|@\w+)/gi;
                const parts = text.split(combinedRegex);

                return parts.map((part, index) => {
                  if (!part) return null;

                  if (isUrl(part) || urlRegex.test(part)) {
                    return (
                      <Text
                        key={index}
                        className={`${
                          isMyMessage ? "text-blue-200" : "text-blue-600"
                        } underline`}
                        onPress={() => {
                          const normalizedUrl = normalizeUrl(part);
                          Linking.openURL(normalizedUrl).catch((err) =>
                            console.error("Failed to open URL:", err)
                          );
                        }}
                      >
                        {part}
                      </Text>
                    );
                  } else if (emailRegex.test(part)) {
                    return (
                      <Text
                        key={index}
                        className={`${
                          isMyMessage ? "text-blue-200" : "text-blue-600"
                        } underline`}
                        onPress={() => {
                          Linking.openURL(`mailto:${part}`).catch((err) =>
                            console.error("Failed to open email:", err)
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

          {/* Enhanced Link Preview */}
          <View
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: isMyMessage
                ? "rgba(255,255,255,0.1)"
                : "#f3f4f6",
              maxWidth: 280,
              borderWidth: 1,
              borderColor: isMyMessage ? "rgba(255,255,255,0.2)" : "#e5e7eb",
            }}
          >
            <LinkPreview
              text={text}
              containerStyle={{
                backgroundColor: "transparent",
                padding: 12,
              }}
              renderTitle={(title) => (
                <Text
                  style={{
                    color: isMyMessage ? "white" : "black",
                    fontSize: 16,
                    fontWeight: "600",
                    marginBottom: 4,
                    lineHeight: 20,
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
                    fontSize: 14,
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
                    fontSize: 12,
                    fontWeight: "500",
                    marginBottom: 6,
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
                    width: "100%",
                    height: 140,

                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                  onError={(error) => {
                    console.log("Image failed to load:", error);
                  }}
                />
              )}
              touchableWithoutFeedbackProps={{
                onPress: () => {
                  // Extract URL from text and open it
                  const urlMatch = text.match(urlRegex);
                  if (urlMatch && urlMatch[0]) {
                    const normalizedUrl = normalizeUrl(urlMatch[0]);
                    Linking.openURL(normalizedUrl).catch((err) =>
                      console.error("Failed to open URL:", err)
                    );
                  }
                },
              }}
            />
          </View>
        </View>
      );
    }

    // If no URLs, render normally with mentions and emails
    const combinedRegex =
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+|@\w+)/gi;
    const parts = text.split(combinedRegex);

    return (
      <Text
        className={`text-base leading-5 ${
          isMyMessage ? "text-white" : "text-gray-900"
        }`}
      >
        {parts.map((part, index) => {
          if (!part) return null;

          if (emailRegex.test(part)) {
            return (
              <Text
                key={index}
                className={`${
                  isMyMessage ? "text-blue-200" : "text-blue-600"
                } underline`}
                onPress={() => {
                  Linking.openURL(`mailto:${part}`).catch((err) =>
                    console.error("Failed to open email:", err)
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
    if (!currentUser) return;
    const msgRef = doc(db, "globalChat", messageId);
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
  const openProfileModal = async (userId: string) => {
    setSelectedUser(userCache[userId]);
    setProfileModalVisible(true);
  };

  // Scroll to pinned message
  const scrollToPinnedMessage = () => {
    if (!pinnedMessage) return;

    const messageIndex = messages.findIndex(
      (msg) => msg.id === pinnedMessage.id
    );
    if (messageIndex !== -1) {
      try {
        flatListRef.current?.scrollToIndex({
          index: messageIndex,
          animated: true,
          viewPosition: 0.5, // Center the message on screen
        });
      } catch (error) {
        // Fallback to scrollToOffset if scrollToIndex fails
        console.log("ScrollToIndex failed, using fallback");
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    } else {
      // Message not found in current messages, scroll to bottom
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  };

  // Pin/Unpin message (admin only)
  const handlePinMessage = async (messageId: string) => {
    if (!currentUser) return;
    const isCurrentUserAdmin =
      currentUserData?.isAdmin ||
      currentUserData?.role === "admin" ||
      userCache[currentUser.uid]?.isAdmin ||
      userCache[currentUser.uid]?.role === "admin";

    if (!isCurrentUserAdmin) {
      Alert.alert("Permission Denied", "Only admins can pin messages.");
      return;
    }

    console.log("Attempting to pin message:", messageId);

    try {
      const pinnedRef = doc(db, "globalChatSettings", "pinned");

      if (pinnedMessage?.id === messageId) {
        // Unpin if already pinned
        await updateDoc(pinnedRef, { messageId: null });
      } else {
        // Pin new message
        await updateDoc(pinnedRef, { messageId });
      }

      setEmojiPickerVisible(false);
      setEmojiPickerMessageId(null);
    } catch (error) {
      // Create document if it doesn't exist
      try {
        const docRef = doc(db, "globalChatSettings", "pinned");
        await setDoc(docRef, { messageId });
      } catch (createError) {
        console.error("Error pinning message:", createError);
        Alert.alert("Error", "Failed to pin message. Please try again.");
      }
    }
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
                // Admin block: Add to all users' blocked lists
                const usersQuery = query(collection(db, "users"));
                const usersSnapshot = await getDocs(usersQuery);

                const batch = writeBatch(db);

                usersSnapshot.forEach((userDoc) => {
                  const userRef = doc(db, "users", userDoc.id);
                  batch.update(userRef, {
                    blockedUsers: arrayUnion(userId),
                    adminBlockedUsers: arrayUnion(userId), // Track admin-blocked users separately
                  });
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

              setEmojiPickerVisible(false);
              setEmojiPickerMessageId(null);
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
                // Admin unblocking: Remove from all users' blocked lists
                const usersQuery = query(collection(db, "users"));
                const usersSnapshot = await getDocs(usersQuery);

                const batch = writeBatch(db);

                usersSnapshot.forEach((userDoc) => {
                  const userRef = doc(db, "users", userDoc.id);
                  batch.update(userRef, {
                    blockedUsers: arrayRemove(userId),
                    adminBlockedUsers: arrayRemove(userId),
                  });
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

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.userId === currentUser?.uid;
    // Always show avatar and name for every message
    const showAvatar = true;
    const showName = true;
    const msgReactions = reactions[item.id] || {};
    const user = userCache[item.userId] || {};
    const isAdmin = user.isAdmin || user.role === "admin";
    const isCurrentUserAdmin =
      currentUserData?.isAdmin ||
      currentUserData?.role === "admin" ||
      userCache[currentUser?.uid]?.isAdmin ||
      userCache[currentUser?.uid]?.role === "admin";

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
                await deleteDoc(doc(db, "globalChat", messageId));
              } catch (e) {
                Alert.alert("Error", "Failed to delete message.");
              }
            },
          },
        ]
      );
    };

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
                  <View className="w-10 h-10 rounded-full overflow-hidden relative">
                    {user.photoUrl ? (
                      <Image
                        source={{ uri: user.photoUrl }}
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
                  <View className="w-10 h-10 rounded-full overflow-hidden relative">
                    {user.photoUrl ? (
                      <Image
                        source={{ uri: user.photoUrl }}
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
                    setCustomEmojiPickerVisible(true);
                    setEmojiPickerVisible(false);
                  }}
                >
                  <Ionicons name="add" size={16} color="#6B7280" />
                </TouchableOpacity>

                {/* Admin pin button */}
                {isCurrentUserAdmin && (
                  <TouchableOpacity
                    style={{
                      marginLeft: 8,
                      marginRight: 2,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onPress={() => handlePinMessage(item.id)}
                  >
                    <AntDesign
                      name={
                        pinnedMessage?.id === item.id ? "pushpin" : "pushpino"
                      }
                      size={26}
                      color={
                        pinnedMessage?.id === item.id ? "#3B82F6" : "#6B7280"
                      }
                      style={{ paddingHorizontal: 2 }}
                    />
                  </TouchableOpacity>
                )}

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

  // Create chat functions
  const handleCreateChat = async () => {
    if (!chatName.trim()) {
      Alert.alert("Error", "Please enter a chat name");
      return;
    }

    if (selectedUsers.size === 0) {
      Alert.alert("Error", "Please select at least one user");
      return;
    }

    setCreating(true);
    try {
      // Get all admin users - ALWAYS include all admins in every sub-chat
      const adminUsers: string[] = [];
      allAppUsers.forEach((user) => {
        if (user.isAdmin || user.role === "admin") {
          adminUsers.push(user.id);
        }
      });

      // Create members array: current user + selected users + ALL admins (with deduplication)
      const membersSet = new Set([
        currentUser!.uid,
        ...Array.from(selectedUsers),
        ...adminUsers, // All admins are automatically added
      ]);
      const membersArray = Array.from(membersSet);

      await addDoc(collection(db, "subChats"), {
        name: chatName.trim(),
        description: chatDescription.trim() || "",
        createdBy: currentUser!.uid,
        members: membersArray,
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        "Success",
        `Group chat created successfully! All admins have been automatically added.`
      );
      setCreateChatModalVisible(false);
      setChatName("");
      setChatDescription("");
      setSelectedUsers(new Set());
      setSearchQuery("");
      // Return to sub-chats list after creating
      setTimeout(() => setSubChatsModalVisible(true), 500);
    } catch (error) {
      console.error("Error creating chat:", error);
      Alert.alert("Error", "Failed to create chat. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <View>
              <Text className="font-gBold text-lg text-gray-900">
                General Chat
              </Text>
              <Text className="text-gray-500 text-sm">
                Campus Creator Club Community
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
              {userCount}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pinned Message */}
        {pinnedMessage && (
          <TouchableOpacity
            className="bg-blue-50 border-b border-blue-200 px-4 py-3"
            onPress={scrollToPinnedMessage}
            activeOpacity={0.7}
          >
            <View className="flex-row items-start">
              <Entypo name="pin" size={16} className="mr-2 " color="#3B82F6" />
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Text className="text-blue-800 text-xs font-gBold">
                    PINNED MESSAGE
                  </Text>
                  <Text className="text-blue-600 text-xs ml-2">
                    by @{pinnedMessage.userName}
                  </Text>
                </View>
                <Text className="text-blue-900 text-sm" numberOfLines={2}>
                  {pinnedMessage.text}
                </Text>
              </View>
              {/* Admin can unpin */}
              {currentUserData?.isAdmin ||
              currentUserData?.role === "admin" ||
              userCache[currentUser?.uid]?.isAdmin ||
              userCache[currentUser?.uid]?.role === "admin" ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePinMessage(pinnedMessage.id);
                  }}
                  className="ml-2"
                >
                  <Ionicons name="close" size={16} color="#3B82F6" />
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
        )}

        {/* Messages List */}
        <View className="flex-1">
          {messagesLoading ? (
            <View className="flex-1 justify-center items-center px-8">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-500 text-lg font-medium mt-4">
                Loading messages...
              </Text>
            </View>
          ) : messages.length === 0 ? (
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

        {/* Users List Modal */}
        <Modal
          visible={usersListVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setUsersListVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl" style={{ height: "70%" }}>
              <View className="bg-white rounded-t-3xl p-6">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="font-gBold text-xl text-gray-900">
                    All Users ({allAppUsers.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => setUsersListVisible(false)}
                    className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center"
                  >
                    <Ionicons name="close" size={18} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Show blocked users section if any */}
                {blockedUsers.length > 0 && (
                  <View className="mb-4">
                    <Text className="font-gBold text-lg text-red-600 mb-2">
                      Blocked Users ({blockedUsers.length})
                    </Text>
                    {blockedUsers.map((blockedUserId) => {
                      const blockedUser = userCache[blockedUserId];
                      if (!blockedUser) return null;

                      const isAdminBlocked =
                        currentUserData?.adminBlockedUsers?.includes(
                          blockedUserId
                        );
                      const isCurrentUserAdmin =
                        currentUserData?.isAdmin ||
                        currentUserData?.role === "admin";

                      return (
                        <View
                          key={blockedUserId}
                          className="flex-row items-center py-2 border-b border-gray-100"
                        >
                          <View className="w-10 h-10 rounded-full overflow-hidden mr-3">
                            {blockedUser.photoUrl ? (
                              <Image
                                source={{ uri: blockedUser.photoUrl }}
                                style={{ width: "100%", height: "100%" }}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                className="w-full h-full items-center justify-center"
                                style={{
                                  backgroundColor:
                                    getAvatarColor(blockedUserId),
                                }}
                              >
                                <Text className="text-white font-gBold text-sm">
                                  {(blockedUser.name || "User")
                                    .charAt(0)
                                    .toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View className="flex-1">
                            <Text className="font-gMedium text-base text-gray-600">
                              {blockedUser.name}
                            </Text>
                            <Text className="text-red-500 text-xs">
                              {isAdminBlocked ? "Blocked by Admin" : "Blocked"}
                            </Text>
                          </View>
                          {/* Only show unblock button for non-admin blocked users or if current user is admin */}
                          {(!isAdminBlocked || isCurrentUserAdmin) && (
                            <TouchableOpacity
                              onPress={() =>
                                handleUnblockUser(
                                  blockedUserId,
                                  blockedUser.name
                                )
                              }
                              className="bg-blue-500 rounded-full px-3 py-1"
                            >
                              <Text className="text-white text-sm font-gMedium">
                                Unblock
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                <FlatList
                  data={allAppUsers}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  renderItem={({ item }) => {
                    const isAdmin = item.isAdmin || item.role === "admin";
                    const isCurrentUser = item.id === currentUser?.uid;
                    return (
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
                                backgroundColor: getAvatarColor(item.id),
                              }}
                            >
                              <Text className="text-white font-gBold text-lg">
                                {(item.name || "User").charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text className="font-gMedium text-base text-gray-900">
                              {item.name}
                              {isCurrentUser && " (You)"}
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
                      </View>
                    );
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Sub-chats Modal */}
        <Modal
          visible={subChatsModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSubChatsModalVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-5/6">
              {/* Header */}
              <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                <Text className="text-2xl font-bold text-gray-900">
                  All Chats
                </Text>
                <View className="flex-row items-center gap-x-3">
                  <TouchableOpacity
                    onPress={() => {
                      setSubChatsModalVisible(false);
                      setTimeout(() => setCreateChatModalVisible(true), 300);
                    }}
                    className="w-10 h-10 bg-blue-500 rounded-full items-center justify-center"
                  >
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSubChatsModalVisible(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Content */}
              <View className="flex-1 px-6 py-4">
                {allChats.length === 0 ? (
                  <View className="flex-1 justify-center items-center">
                    <Ionicons
                      name="chatbubbles-outline"
                      size={64}
                      color="#9CA3AF"
                    />
                    <Text className="text-gray-500 text-lg font-medium mt-4">
                      No chats yet
                    </Text>
                    <Text className="text-gray-400 text-center mt-2">
                      Create group chats and campaigns to get started
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={allChats}
                    keyExtractor={(item) => `${item.type}-${item.id}`}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        className="flex-row items-center px-4 py-3 border-b border-gray-100 bg-white active:bg-gray-50"
                        onPress={() => {
                          setSubChatsModalVisible(false);
                          if (item.type === "subchat") {
                            router.push(
                              `/(admin-tabs)/chat/sub-chat?id=${item.id}` as any
                            );
                          } else {
                            router.push(
                              `/(admin-tabs)/chat/campaign-chat?campaignId=${item.id}` as any
                            );
                          }
                        }}
                      >
                        {/* Avatar */}
                        <View className="w-12 h-12 rounded-full mr-3 overflow-hidden">
                          {item.type === "campaign" && item.photoUrl ? (
                            <Image
                              source={{ uri: item.photoUrl }}
                              style={{ width: "100%", height: "100%" }}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              className={`w-full h-full rounded-full items-center justify-center ${
                                item.type === "subchat"
                                  ? "bg-blue-500"
                                  : "bg-green-500"
                              }`}
                            >
                              <Text className="text-white font-gBold text-lg">
                                {item.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Content */}
                        <View className="flex-1">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text
                              className="font-gBold text-base text-gray-900 flex-1"
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                            <Text className="text-gray-400 text-xs ml-2">
                              {item.members?.length || 0} members
                            </Text>
                          </View>
                          {item.type === "campaign" && (
                            <View className="bg-green-100 rounded-full px-2 py-1 self-start">
                              <Text className="text-green-700 text-xs font-gBold">
                                Campaign
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Chevron */}
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#C7C7CC"
                        />
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Create Chat Modal */}
        <Modal
          visible={createChatModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCreateChatModalVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-5/6">
              {/* Header */}
              <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => {
                      setCreateChatModalVisible(false);
                      setTimeout(() => setSubChatsModalVisible(true), 300);
                    }}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3"
                  >
                    <Ionicons name="arrow-back" size={20} color="#6B7280" />
                  </TouchableOpacity>
                  <Text className="text-2xl font-bold text-gray-900">
                    Create Group Chat
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setCreateChatModalVisible(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                className="flex-1 px-6 py-4"
                showsVerticalScrollIndicator={false}
              >
                {/* Chat Name */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-base mb-2">
                    Chat Name
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="e.g., CCC Marketing, UGC Round 2"
                    value={chatName}
                    onChangeText={setChatName}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Chat Description */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-base mb-2">
                    Description (Optional)
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="Brief description of this chat"
                    value={chatDescription}
                    onChangeText={setChatDescription}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* User Search */}
                <View className="mb-4">
                  <Text className="text-gray-600 text-base mb-2">
                    Add Members
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
                          users.map((user) => user.id)
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
                        Select All ({users.length})
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
                  {filteredUsers.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      className={`flex-row items-center p-3 rounded-xl mb-2 ${
                        selectedUsers.has(user.id)
                          ? "bg-blue-100"
                          : "bg-gray-50"
                      }`}
                      onPress={() => toggleUserSelection(user.id)}
                    >
                      <View className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center mr-3">
                        <Text className="text-gray-600 font-gBold text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-gMedium text-gray-900">
                          {user.name}
                        </Text>
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
                  ))}
                </View>
              </ScrollView>

              {/* Create Button */}
              <View className="p-6 border-t border-gray-100">
                <TouchableOpacity
                  onPress={handleCreateChat}
                  disabled={
                    creating || !chatName.trim() || selectedUsers.size === 0
                  }
                  className={`rounded-2xl py-4 items-center justify-center ${
                    creating || !chatName.trim() || selectedUsers.size === 0
                      ? "bg-gray-300"
                      : "bg-blue-500"
                  }`}
                >
                  {creating ? (
                    <Text className="text-white text-lg font-semibold">
                      Creating...
                    </Text>
                  ) : (
                    <Text className="text-white text-lg font-semibold">
                      Create Group Chat
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Custom Emoji Picker Modal */}
        <Modal
          visible={customEmojiPickerVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCustomEmojiPickerVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-4/5">
              {/* Header */}
              <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                <Text className="text-2xl font-bold text-gray-900">
                  Choose Emoji
                </Text>
                <TouchableOpacity
                  onPress={() => setCustomEmojiPickerVisible(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Emoji Grid */}
              <ScrollView
                className="flex-1 px-4 py-4"
                showsVerticalScrollIndicator={false}
              >
                <View className="flex-row flex-wrap">
                  {EXTENDED_EMOJIS.map((emoji, index) => (
                    <TouchableOpacity
                      key={index}
                      style={{
                        width: "12.5%",
                        aspectRatio: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        padding: 4,
                      }}
                      onPress={() => {
                        if (emojiPickerMessageId) {
                          handleReact(emojiPickerMessageId, emoji);
                        }
                        setCustomEmojiPickerVisible(false);
                        setEmojiPickerMessageId(null);
                      }}
                    >
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
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
