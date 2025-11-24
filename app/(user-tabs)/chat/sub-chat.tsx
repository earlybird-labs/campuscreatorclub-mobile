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
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Entypo, Ionicons } from "@expo/vector-icons";
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
  startAfter,
  getDocs,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

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

interface SubChat {
  id: string;
  name: string;
  description?: string;
  members: string[];
  createdBy: string;
  createdAt: any;
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

export default function SubChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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
  const [customEmojiPickerVisible, setCustomEmojiPickerVisible] =
    useState(false);
  const [usersListVisible, setUsersListVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [allAppUsers, setAllAppUsers] = useState<any[]>([]);

  // Pagination state
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [lastMessageDoc, setLastMessageDoc] = useState<any>(null);

  // New state for reporting and blocking
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(
    null
  );
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [adminBlockedUsers, setAdminBlockedUsers] = useState<string[]>([]);
  const [subChatInfoModalVisible, setSubChatInfoModalVisible] = useState(false);

  const db = getFirestore();
  const auth = getAuth();
  // Swipe-to-reply gesture refs
  const swipeStartXRef = useRef<number | null>(null);
  const swipeActiveMsgRef = useRef<string | null>(null);
  const swipeTriggeredRef = useRef<boolean>(false);

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
    setLoading(false);
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

  // Listen for messages in real-time
  useEffect(() => {
    if (!id || !currentUser) return;

    const messagesRef = collection(db, "subChats", id as string, "messages");
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
  }, [id, currentUser, blockedUsers]);

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
      console.log("No subchat members found");
      setAllUsers([]);
      return;
    }

    console.log(
      "Fetching users for subchat members:",
      subChatInfo.members.length
    );

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

        console.log("Found subchat users:", users.length);
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

  // Fetch all users for mention suggestions
  useEffect(() => {
    const q = query(collection(db, "users"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!querySnapshot) {
          console.log("Users QuerySnapshot is null");
          setAllAppUsers([]);
          return;
        }

        const allUsersData: any[] = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
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
        });

        // Sort users alphabetically by name
        allUsersData.sort((a, b) => a.name.localeCompare(b.name));
        setAllAppUsers(allUsersData);
      },
      (error) => {
        console.error("Error fetching users:", error);
        setAllAppUsers([]);
      }
    );

    return () => unsubscribe();
  }, []);

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

      // Extract mentions from the message
      const mentionRegex = /@(\w+)/g;
      const mentions = [];
      let match;

      while ((match = mentionRegex.exec(messageText)) !== null) {
        const mentionedUsername = match[1].toLowerCase();
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

      await addDoc(
        collection(db, "subChats", id as string, "messages"),
        messageData
      );

      // Send push notifications to mentioned users
      if (mentions.length > 0) {
        await sendMentionNotifications(mentions, messageText);
      }

      setInputText("");
      setReplyingTo(null);
      setShowMentionSuggestions(false);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
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
      const chatName = subChatInfo?.name || "Group Chat";

      for (const mention of mentions) {
        if (mention.expoPushToken) {
          const notificationData = {
            to: mention.expoPushToken,
            sound: "default",
            title: `${senderName} mentioned you in ${chatName}`,
            body:
              messageText.length > 100
                ? `${messageText.substring(0, 100)}...`
                : messageText,
            data: {
              type: "mention",
              senderId: currentUser?.uid,
              senderName: senderName,
              chatType: "subchat",
              chatId: id,
              chatName: chatName,
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
        const suggestions = allAppUsers
          .filter(
            (user) =>
              user.id !== currentUser?.uid &&
              user.name.toLowerCase().includes(queryText.toLowerCase())
          )
          .slice(0, 5); // Limit to 5 suggestions

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
      const username = user.name.toLowerCase().replace(/\s+/g, "");
      setInputText(`${beforeAt}@${username} ${afterQuery}`);
    }
    setShowMentionSuggestions(false);
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
  const renderTextWithLinks = (text: string, isMyMessage: boolean) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const mentionRegex = /(@\w+)/g;

    // Check if the message contains any URLs
    const hasUrl =
      /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g.test(text);

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
                // Split by both URLs and mentions
                const combinedRegex = /(https?:\/\/[^\s]+|@\w+)/g;
                const parts = text.split(combinedRegex);

                return parts.map((part, index) => {
                  if (urlRegex.test(part)) {
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
                  } else if (mentionRegex.test(part)) {
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
          <LinkPreview
            text={text}
            containerStyle={{
              backgroundColor: isMyMessage
                ? "rgba(255,255,255,0.1)"
                : "#f3f4f6",
              maxWidth: 280,
              borderWidth: isMyMessage ? 0 : 1,
              borderColor: isMyMessage ? "transparent" : "#e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
            renderTitle={(title) => {
              // Extract URL from text for fallback
              const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
              const url = urlMatch ? urlMatch[0] : "";

              let displayTitle = title;

              // If no title, provide fallbacks
              if (!displayTitle) {
                if (text.includes("tiktok.com")) {
                  displayTitle = "TikTok";
                } else if (url) {
                  // Show domain name or full URL as title
                  try {
                    const domain = new URL(url).hostname.replace("www.", "");
                    displayTitle = domain;
                  } catch {
                    displayTitle = url;
                  }
                }
              }

              if (!displayTitle) return null;

              return (
                <Text
                  style={{
                    fontWeight: "bold",
                    color: isMyMessage ? "white" : "black",
                  }}
                >
                  {displayTitle}
                </Text>
              );
            }}
            renderText={() => null}
            renderDescription={(desc) => {
              // If there's a description, show it
              if (desc) {
                return (
                  <Text style={{ color: isMyMessage ? "white" : "black" }}>
                    {desc}
                  </Text>
                );
              }

              // If no description and no title was shown, show URL as description
              const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
              const url = urlMatch ? urlMatch[0] : "";

              if (url && !text.includes("tiktok.com")) {
                return (
                  <Text
                    style={{
                      color: isMyMessage ? "rgba(255,255,255,0.8)" : "#6B7280",
                      fontSize: 12,
                    }}
                    numberOfLines={1}
                  >
                    {url}
                  </Text>
                );
              }

              return null;
            }}
            renderHeader={(header) => (
              <Text style={{ color: isMyMessage ? "white" : "black" }}>
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
                  marginBottom: 10,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              />
            )}
            renderLinkPreview={(payload) => {
              // Extract URL from text
              const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
              const url = urlMatch ? urlMatch[0] : "";

              if (text.includes("tiktok.com")) {
                return (
                  <View style={{ padding: 12 }}>
                    <Text
                      style={{
                        fontWeight: "bold",
                        color: isMyMessage ? "white" : "black",
                      }}
                    >
                      TikTok
                    </Text>
                  </View>
                );
              }

              // Show preview data if available, otherwise show URL
              if (url) {
                return (
                  <View style={{ padding: 12 }}>
                    {payload.previewData?.title && (
                      <Text
                        style={{
                          fontWeight: "600",
                          color: isMyMessage ? "white" : "black",
                          marginBottom: 4,
                        }}
                      >
                        {payload.previewData?.title}
                      </Text>
                    )}

                    {payload.previewData?.image && (
                      <Image
                        source={{ uri: payload.previewData.image.url }}
                        contentFit="cover"
                        style={{
                          width: 250,
                          height: 140,
                          borderRadius: 8,
                          marginBottom: 10,
                        }}
                      />
                    )}
                    {payload.previewData?.description && (
                      <Text
                        style={{
                          color: isMyMessage ? "white" : "black",
                          fontSize: 12,
                          marginBottom: 4,
                        }}
                        numberOfLines={2}
                      >
                        {payload.previewData?.description}
                      </Text>
                    )}
                  </View>
                );
              }

              return null;
            }}
          />
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
                        borderRadius: 15,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
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
                          fontSize: 9,
                          color: "#DC2626",
                          fontWeight: "500",
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
                        borderRadius: 15,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
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
                      <Ionicons name="ban" size={14} color="#DC2626" />
                      <Text
                        style={{
                          fontSize: 9,
                          color: "#DC2626",
                          fontWeight: "500",
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
                    borderRadius: 11,
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
                {/* Plus button for custom emoji */}
                <TouchableOpacity
                  style={{
                    marginHorizontal: 4,
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
          {/* Member count badge */}
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
              {subChatInfo?.members?.length || 0}
            </Text>
          </TouchableOpacity>
        </View>

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
                    className="flex-row items-center bg-white rounded-full px-3 py-2 border border-gray-200"
                  >
                    <View className="w-6 h-6 rounded-full mr-2 overflow-hidden">
                      {user.photoUrl ? (
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
                    <Text className="text-gray-800 font-gMedium text-sm">
                      {user.name}
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
                    <View className="mb-6">
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
                              onPress={() => handleUnblockUser(item.id)}
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
                            {/* Block button for regular members */}
                            <TouchableOpacity
                              onPress={() => handleBlockUser(item.id)}
                              className="px-4 py-2 rounded-full ml-2 bg-red-100"
                            >
                              <Text className="font-gMedium text-sm text-red-600">
                                Block
                              </Text>
                            </TouchableOpacity>
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

              <TouchableOpacity
                onPress={() => setSubChatInfoModalVisible(false)}
                className="bg-blue-500 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-gBold text-base">Close</Text>
              </TouchableOpacity>
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
}
