import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  addDoc,
  serverTimestamp,
  limit,
  updateDoc,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { serverTimestamp as serverTS } from "@react-native-firebase/firestore";
import { useBadgeManager } from "../../../hooks/useBadgeManager";

type SubChat = {
  id: string;
  name: string;
  description?: string;
  members?: string[];
  createdAt?: any;
};

type Campaign = {
  id: string;
  title: string;
  photoUrl?: string;
  createdAt?: any;
  applied?: string[];
  approved?: string[];
  rejected?: string[];
};

type ChatItem = {
  id: string;
  name: string;
  type: "subchat" | "campaign";
  members?: string[];
  createdAt?: any;
  photoUrl?: string;
  status?: string;
};

export default function AdminChatsList() {
  const db = getFirestore();
  const auth = getAuth();
  const [subChats, setSubChats] = useState<SubChat[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [lastRead, setLastRead] = useState<Record<string, any>>({});
  const latestRef = useRef<Record<string, any>>({});
  const latestMessageRef = useRef<Record<string, string>>({});
  const unsubLatestRef = useRef<(() => void)[]>([]);

  // Initialize badge manager for admin
  const { unreadChatsCount } = useBadgeManager();

  // Create Group modal state
  const [createChatModalVisible, setCreateChatModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [chatName, setChatName] = useState("");
  const [chatDescription, setChatDescription] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "subchats" | "campaigns">("all");

  useEffect(() => {
    // Current user data observer (lightweight, keep always active)
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubUser = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) setCurrentUserData(snap.data());
    });
    const unsubUserLR = onSnapshot(doc(db, "users", uid), (snap) => {
      const d = snap.data() as any;
      setLastRead(d?.lastRead || {});
    });
    return () => {
      unsubUser();
      unsubUserLR();
    };
  }, []);

  useEffect(() => {
    // Load users ONLY when modal is visible to avoid UI lag
    if (!createChatModalVisible) return;
    const uid = auth.currentUser?.uid;
    setUsersLoading(true);
    const unsubUsers = onSnapshot(query(collection(db, "users")), (qs) => {
      const list: any[] = [];
      qs.forEach((d) => {
        if (d.id !== uid) {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || "Unknown",
            email: data.email || "",
            university: data.university,
            isAdmin: data.isAdmin || data.role === "admin",
          });
        }
      });
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setUsers(list);
      setUsersLoading(false);
    });
    return () => {
      unsubUsers();
      // reset quick state for snappy close
      setSelectedUsers(new Set());
      setSearchQuery("");
    };
  }, [createChatModalVisible]);

  useEffect(() => {
    const subChatsRef = collection(db, "subChats");
    const unsubSub = onSnapshot(
      query(subChatsRef, orderBy("createdAt", "desc")),
      (snap) => {
        const items: SubChat[] = [];
        snap.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setSubChats(items);
      }
    );

    const campaignsRef = collection(db, "campaigns");
    const unsubCamp = onSnapshot(
      query(campaignsRef, orderBy("createdAt", "desc")),
      (snap) => {
        const items: Campaign[] = [];
        snap.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setCampaigns(items);
      }
    );

    return () => {
      unsubSub();
      unsubCamp();
    };
  }, []);

  // Build latest message listeners per chat for unread red dot
  useEffect(() => {
    unsubLatestRef.current.forEach((u) => u());
    unsubLatestRef.current = [];
    latestRef.current = {};
    latestMessageRef.current = {};

    // subchats
    subChats.forEach((sc) => {
      const key = `subchat_${sc.id}`;
      const unsub = onSnapshot(
        query(
          collection(db, "subChats", sc.id, "messages"),
          orderBy("createdAt", "desc"),
          limit(1)
        ),
        (qs) => {
          if (qs.empty) {
            latestRef.current[key] = null;
            latestMessageRef.current[key] = "";
          } else {
            const data = qs.docs[0].data();
            latestRef.current[key] = data.createdAt || data.timestamp;
            latestMessageRef.current[key] = data.text || data.message || "";
          }
        }
      );
      unsubLatestRef.current.push(unsub);
    });

    // campaigns (approved only if specified in doc)
    campaigns.forEach((c) => {
      const key = `campaign_${c.id}`;
      const approved = new Set(c.approved || []);
      const unsub = onSnapshot(
        query(
          collection(db, "campaigns", c.id, "chat"),
          orderBy("createdAt", "desc"),
          limit(5)
        ),
        (qs) => {
          let latest: any = null;
          let latestMessage = "";
          qs.forEach((d) => {
            const data = d.data() as any;
            if (approved.size === 0 || approved.has(data.userId)) {
              if (!latest) {
                latest = data.createdAt || data.timestamp;
                latestMessage = data.text || data.message || "";
              }
            }
          });
          latestRef.current[key] = latest;
          latestMessageRef.current[key] = latestMessage;
        }
      );
      unsubLatestRef.current.push(unsub);
    });

    // General chat latest
    const unsubGeneral = onSnapshot(
      query(
        collection(db, "globalChat"), // assuming collection name for general
        orderBy("createdAt", "desc"),
        limit(1)
      ),
      (qs) => {
        if (qs.empty) {
          latestRef.current["general"] = null;
          latestMessageRef.current["general"] = "";
        } else {
          const data = qs.docs[0].data();
          latestRef.current["general"] = data.createdAt || data.timestamp;
          latestMessageRef.current["general"] = data.text || data.message || "";
        }
      }
    );
    unsubLatestRef.current.push(unsubGeneral);

    return () => {
      unsubLatestRef.current.forEach((u) => u());
      unsubLatestRef.current = [];
    };
  }, [subChats, campaigns]);

  const isGeneralUnread = () => {
    const latest = latestRef.current["general"];
    const last = lastRead?.["general"];
    if (!latest) return false;
    if (!last) return true;
    const l = latest.seconds || latest._seconds || 0;
    const r = last.seconds || last._seconds || 0;
    return l > r;
  };

  const markAsRead = async (key: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await updateDoc(doc(db, "users", uid), {
        [`lastRead.${key}`]: serverTS(),
      } as any);
    } catch {}
  };

  const getLatestMessage = (item: ChatItem) => {
    const key =
      item.type === "subchat" ? `subchat_${item.id}` : `campaign_${item.id}`;
    const message = latestMessageRef.current[key];
    if (!message || message.trim() === "") {
      return ""; // Return empty string instead of fallback text
    }
    return message.length > 50 ? message.substring(0, 50) + "..." : message;
  };

  const getGeneralLatestMessage = () => {
    const message = latestMessageRef.current["general"];
    if (!message || message.trim() === "") {
      return ""; // Return empty string instead of fallback text
    }
    return message.length > 50 ? message.substring(0, 50) + "..." : message;
  };

  const isUnread = (item: ChatItem) => {
    const key =
      item.type === "subchat" ? `subchat_${item.id}` : `campaign_${item.id}`;
    const latest = latestRef.current[key];
    const last = lastRead?.[key];
    if (!latest) return false;
    if (!last) return true;
    const latestSec = latest.seconds || latest._seconds || 0;
    const lastSec = last.seconds || last._seconds || 0;
    return latestSec > lastSec;
  };

  const allChats: ChatItem[] = useMemo(() => {
    const items: ChatItem[] = [];
    subChats.forEach((sc) =>
      items.push({
        id: sc.id,
        name: sc.name,
        type: "subchat",
        members: sc.members || [],
        createdAt: sc.createdAt,
      })
    );
    campaigns
      .filter((c) => (c as any).status !== "completed") // Hide completed campaigns
      .forEach((c) =>
        items.push({
          id: c.id,
          name: c.title,
          type: "campaign",
          members: [
            ...(c.applied || []),
            ...(c.approved || []),
            ...(c.rejected || []),
          ],
          createdAt: c.createdAt,
          photoUrl: c.photoUrl,
          status: (c as any).status,
        })
      );

    // Sort by most recent message activity, then by unread status
    items.sort((a, b) => {
      const keyA =
        a.type === "subchat" ? `subchat_${a.id}` : `campaign_${a.id}`;
      const keyB =
        b.type === "subchat" ? `subchat_${b.id}` : `campaign_${b.id}`;

      const latestA = latestRef.current[keyA];
      const latestB = latestRef.current[keyB];

      // Check if chats are unread
      const isUnreadA = isUnread(a);
      const isUnreadB = isUnread(b);

      // If one is unread and the other isn't, prioritize unread
      if (isUnreadA && !isUnreadB) return -1;
      if (!isUnreadA && isUnreadB) return 1;

      // If both have same read status, sort by most recent message
      if (latestA && latestB) {
        const timeA = latestA.seconds || latestA._seconds || 0;
        const timeB = latestB.seconds || latestB._seconds || 0;
        return timeB - timeA; // Most recent first
      }

      // If no latest message, use creation time as fallback
      const timeA = latestA
        ? latestA.seconds || latestA._seconds || 0
        : a.createdAt?.seconds || 0;
      const timeB = latestB
        ? latestB.seconds || latestB._seconds || 0
        : b.createdAt?.seconds || 0;

      return timeB - timeA; // Most recent first
    });

    return items;
  }, [subChats, campaigns, latestRef.current, lastRead]);

  const filteredChats: ChatItem[] = useMemo(() => {
    switch (filter) {
      case "subchats":
        return allChats.filter((c) => c.type === "subchat");
      case "campaigns":
        return allChats.filter((c) => c.type === "campaign");
      default:
        // For "all" filter, General chat is handled separately in the FlatList
        // Return all chats (General will be pinned at top via ListHeaderComponent)
        return allChats;
    }
  }, [allChats, filter]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
        <Text className="font-gBold text-xl text-gray-900">Chats</Text>
        <View className="flex-row items-center gap-x-2">
          {/* <TouchableOpacity
            onPress={() => setFilterMenuOpen((p) => !p)}
            className="px-3 h-10 bg-gray-100 rounded-full items-center justify-center"
          >
            <Text className="text-gray-700 text-sm font-gMedium">
              {filter === "all"
                ? "All"
                : filter === "subchats"
                ? "Sub-chats"
                : filter === "campaigns"
                ? "Campaigns"
                : filter === "campaigns_active"
                ? "Active"
                : "Completed"}
            </Text>
          </TouchableOpacity> */}
          {(currentUserData?.isAdmin || currentUserData?.role === "admin") && (
            <TouchableOpacity
              onPress={() => setCreateChatModalVisible(true)}
              className="w-10 h-10 bg-blue-500 rounded-full items-center justify-center"
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* {filterMenuOpen && ( */}
      <View className="px-5 py-2 border-b border-gray-100 bg-white">
        <View className="flex-row flex-wrap gap-2">
          {[
            { k: "all", l: "All" },
            { k: "subchats", l: "Sub-chats" },
            { k: "campaigns", l: "Campaigns" },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.k}
              className={`px-3 py-1 rounded-full border ${
                filter === (opt.k as any)
                  ? "bg-blue-50 border-blue-300"
                  : "bg-gray-50 border-gray-200"
              }`}
              onPress={() => {
                setFilter(opt.k as any);
                setFilterMenuOpen(false);
              }}
            >
              <Text
                className={`text-xs ${
                  filter === (opt.k as any) ? "text-blue-600" : "text-gray-700"
                }`}
              >
                {opt.l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {/* )} */}

      {allChats.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="chatbubbles-outline" size={64} color="#9CA3AF" />
          <Text className="text-gray-500 text-lg font-medium mt-4">
            No chats yet
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            Create group chats and campaigns to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          ListHeaderComponent={
            filter === "all" ? (
              <TouchableOpacity
                className="flex-row items-center px-5 py-4 border-b border-gray-100 bg-white active:bg-gray-50"
                onPress={async () => {
                  await markAsRead("general");
                  router.push("/(admin-tabs)/chat" as any);
                }}
              >
                <View className="w-12 h-12 mr-3 relative">
                  <View className="w-12 h-12 rounded-full overflow-hidden">
                    <View className="w-full h-full rounded-full items-center justify-center bg-blue-500">
                      <Ionicons name="globe-outline" size={21} color="#fff" />
                    </View>
                  </View>
                  {/* Unread red dot for General */}
                  {isGeneralUnread() && (
                    <View className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 border-2 border-white" />
                  )}
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text
                      className="font-gBold text-base text-gray-900 flex-1"
                      numberOfLines={1}
                    >
                      General
                    </Text>
                  </View>
                  <Text
                    className={`text-xs ${
                      isGeneralUnread()
                        ? "text-gray-700 font-bold"
                        : "text-gray-500"
                    }`}
                    numberOfLines={1}
                  >
                    {getGeneralLatestMessage()}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className="flex-row items-center px-5 py-4 border-b border-gray-100 bg-white active:bg-gray-50"
              onPress={() => {
                const key =
                  item.type === "subchat"
                    ? `subchat_${item.id}`
                    : `campaign_${item.id}`;
                markAsRead(key);
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
              <View className="w-12 h-12 mr-3 relative">
                <View className="w-12 h-12 rounded-full overflow-hidden">
                  {item.type === "campaign" && item.photoUrl ? (
                    <Image
                      source={{ uri: item.photoUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      className={`w-full h-full rounded-full items-center justify-center ${
                        item.type === "subchat" ? "bg-blue-500" : "bg-green-500"
                      }`}
                    >
                      <Text className="text-white font-gBold text-lg">
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Unread red dot */}
                {isUnread(item) && (
                  <View className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 border-2 border-white" />
                )}
              </View>

              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text
                    className="font-gBold text-base text-gray-900 flex-1"
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text className="text-gray-400 text-xs ml-0">
                    {item.members?.length || 0} members
                  </Text>
                </View>
                <Text
                  className={`text-xs ${
                    isUnread(item) ? "text-gray-700 font-bold" : "text-gray-500"
                  }`}
                  numberOfLines={1}
                >
                  {getLatestMessage(item)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      {/* Create Group Modal */}
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
              <Text className="text-2xl font-bold text-gray-900">
                Create Group Chat
              </Text>
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
                <Text className="text-gray-600 text-base mb-2">Chat Name</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                  placeholder="e.g., CCC Marketing, UGC Round 2"
                  value={chatName}
                  onChangeText={setChatName}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Description */}
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

              {/* Search Users */}
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
                {/* Select All / Clear */}
                <View className="flex-row gap-x-3 mb-4">
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedUsers(new Set(users.map((u) => u.id)))
                    }
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
                      onPress={() => setSelectedUsers(new Set())}
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

              {/* Users list */}
              <View className="mb-6">
                {usersLoading ? (
                  <View className="items-center py-6">
                    <ActivityIndicator size="large" color="#6476E8" />
                    <Text className="text-gray-500 mt-2">Loading users...</Text>
                  </View>
                ) : (
                  users
                    .filter(
                      (u) =>
                        (u.name || "")
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        (u.email || "")
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase())
                    )
                    .map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        className={`flex-row items-center p-3 rounded-xl mb-2 ${
                          selectedUsers.has(user.id)
                            ? "bg-blue-100"
                            : "bg-gray-50"
                        }`}
                        onPress={() => {
                          const s = new Set(selectedUsers);
                          if (s.has(user.id)) s.delete(user.id);
                          else s.add(user.id);
                          setSelectedUsers(s);
                        }}
                      >
                        <View className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center mr-3">
                          <Text className="text-gray-600 font-gBold text-sm">
                            {user.name?.charAt(0).toUpperCase()}
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
                    ))
                )}
              </View>
            </ScrollView>

            {/* Create Button */}
            <View className="p-6 border-t border-gray-100">
              <TouchableOpacity
                onPress={async () => {
                  if (!chatName.trim()) return;
                  const uid = auth.currentUser?.uid;
                  if (!uid) return;
                  setCreating(true);
                  try {
                    // include all admins automatically
                    const adminIds = users
                      .filter((u) => u.isAdmin)
                      .map((u) => u.id);
                    const membersSet = new Set<string>([
                      uid,
                      ...Array.from(selectedUsers),
                      ...adminIds,
                    ]);
                    await addDoc(collection(db, "subChats"), {
                      name: chatName.trim(),
                      description: chatDescription.trim() || "",
                      createdBy: uid,
                      members: Array.from(membersSet),
                      createdAt: serverTimestamp(),
                    } as any);
                    setCreateChatModalVisible(false);
                    setChatName("");
                    setChatDescription("");
                    setSelectedUsers(new Set());
                    setSearchQuery("");
                  } catch (e) {
                    // no-op
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating || !chatName.trim()}
                className={`rounded-2xl py-4 items-center justify-center ${
                  creating || !chatName.trim() ? "bg-gray-300" : "bg-blue-500"
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
    </SafeAreaView>
  );
}
