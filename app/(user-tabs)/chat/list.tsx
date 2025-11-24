import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
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
  updateDoc,
  doc,
  arrayUnion,
  limit,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { serverTimestamp } from "@react-native-firebase/firestore";
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
  status?: "active" | "completed";
};

type ChatItem = {
  id: string;
  name: string;
  type: "subchat" | "campaign";
  members?: string[];
  createdAt?: any;
  photoUrl?: string;
  description?: string;
};

export default function UserChatsList() {
  const db = getFirestore();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [subChats, setSubChats] = useState<SubChat[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lastRead, setLastRead] = useState<Record<string, any>>({});
  const latestRef = useRef<Record<string, any>>({});
  const latestMessageRef = useRef<Record<string, string>>({});
  const unsubLatestRef = useRef<(() => void)[]>([]);
  const [filter, setFilter] = useState<"all" | "subchats" | "campaigns">("all");

  // Initialize badge manager
  const { unreadChatsCount } = useBadgeManager();

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

    // Listen to user's lastRead map in real-time
    let unsubUser: undefined | (() => void);
    if (currentUser?.uid) {
      unsubUser = onSnapshot(doc(db, "users", currentUser.uid), (ds) => {
        const data = ds.data() as any;
        setLastRead(data?.lastRead || {});
      });
    }

    return () => {
      unsubSub();
      unsubCamp();
      if (unsubUser) unsubUser();
    };
  }, []);

  const isUnread = (item: ChatItem) => {
    const key =
      item.type === "subchat" ? `subchat_${item.id}` : `campaign_${item.id}`;
    const latest = latestRef.current[key];
    const last = lastRead?.[key];
    if (!latest) return false;
    if (!last) return true;
    try {
      const latestSec = latest.seconds || latest._seconds || 0;
      const lastSec = last.seconds || last._seconds || 0;
      return latestSec > lastSec;
    } catch {
      return false;
    }
  };

  const allChats: ChatItem[] = useMemo(() => {
    const uid = currentUser?.uid;
    const items: ChatItem[] = [];

    // Only include subchats where user is a member
    subChats.forEach((sc) => {
      const members = sc.members || [];
      if (uid && members.includes(uid)) {
        items.push({
          id: sc.id,
          name: sc.name,
          type: "subchat",
          members,
          createdAt: sc.createdAt,
          description: sc.description,
        });
      }
    });

    // Only include campaigns where user is involved (applied/approved/rejected)
    campaigns.forEach((c) => {
      const members = [
        ...(c.applied || []),
        ...(c.approved || []),
        ...(c.rejected || []),
      ];
      const isInvolved = uid && members.includes(uid);

      // Only show campaigns that are not completed
      const isNotCompleted = !c.status || c.status !== "completed";

      if (isInvolved && isNotCompleted) {
        items.push({
          id: c.id,
          name: c.title,
          type: "campaign",
          members,
          createdAt: c.createdAt,
          photoUrl: c.photoUrl,
        });
      }
    });

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
  }, [subChats, campaigns, currentUser?.uid, latestRef.current, lastRead]);

  // Build latest message listeners per chat (subchat and campaign)
  useEffect(() => {
    // cleanup previous
    unsubLatestRef.current.forEach((u) => u());
    unsubLatestRef.current = [];
    latestRef.current = {};
    latestMessageRef.current = {};

    const uid = currentUser?.uid;
    if (!uid) return;

    // General chat latest message
    const generalUnsub = onSnapshot(
      query(
        collection(db, "globalChat"),
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
    unsubLatestRef.current.push(generalUnsub);

    // subchats latest
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

    // campaigns latest (only from approved users if available)
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

    return () => {
      unsubLatestRef.current.forEach((u) => u());
      unsubLatestRef.current = [];
    };
  }, [subChats, campaigns, currentUser?.uid]);

  const markAsRead = async (key: string) => {
    if (!currentUser?.uid) return;
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        [`lastRead.${key}`]: serverTimestamp(),
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

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
        <Text className="font-gBold text-xl text-gray-900">Chats</Text>
      </View>

      {/* Filters */}
      <View className="px-5 py-2 border-b border-gray-100 bg-white">
        <View className="flex-row flex-wrap gap-2">
          {[
            { k: "all", l: "All" },
            { k: "subchats", l: "Groups" },
            { k: "campaigns", l: "Campaigns" },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.k}
              className={`px-3 py-1 rounded-full border ${
                filter === (opt.k as any)
                  ? "bg-blue-50 border-blue-300"
                  : "bg-gray-50 border-gray-200"
              }`}
              onPress={() => setFilter(opt.k as any)}
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

      <FlatList
        data={(() => {
          if (filter === "subchats") {
            return allChats.filter((c) => c.type === "subchat");
          }
          if (filter === "campaigns") {
            return allChats.filter((c) => c.type === "campaign");
          }
          return allChats;
        })()}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        ListHeaderComponent={
          filter === "all" ? (
            <TouchableOpacity
              className="flex-row items-center px-5 py-4 border-b border-gray-100 bg-white active:bg-gray-50"
              onPress={async () => {
                if (currentUser?.uid) {
                  await markAsRead("general");
                }
                router.push("/(user-tabs)/chat" as any);
              }}
            >
              <View className="w-12 h-12 mr-3 relative">
                <View className="w-12 h-12 rounded-full overflow-hidden">
                  <View className="w-full h-full rounded-full items-center justify-center bg-blue-500">
                    <Ionicons name="globe-outline" size={21} color="#fff" />
                  </View>
                </View>
                {(() => {
                  const latest = latestRef.current["general"];
                  const last = lastRead?.["general"];
                  const show = (() => {
                    if (!latest) return false;
                    if (!last) return true;
                    const lsec = latest?.seconds || latest?._seconds || 0;
                    const rsec = last?.seconds || last?._seconds || 0;
                    return lsec > rsec;
                  })();
                  return show ? (
                    <View className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 border-2 border-white" />
                  ) : null;
                })()}
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
                  className={`text-xs ${(() => {
                    const latest = latestRef.current["general"];
                    const last = lastRead?.["general"];
                    const isUnread = (() => {
                      if (!latest) return false;
                      if (!last) return true;
                      const lsec = latest?.seconds || latest?._seconds || 0;
                      const rsec = last?.seconds || last?._seconds || 0;
                      return lsec > rsec;
                    })();
                    return isUnread
                      ? "text-gray-700 font-bold"
                      : "text-gray-500";
                  })()}`}
                  numberOfLines={1}
                >
                  {latestMessageRef.current["general"] || ""}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null
        }
        ListHeaderComponentStyle={{}}
        ListFooterComponent={(() => {
          const uid = currentUser?.uid;
          const joinable = (subChats || []).filter(
            (sc) => !(sc.members || []).includes(uid || "")
          );
          if (joinable.length === 0) return null as any;
          return (
            <View className="mt-2">
              <View className="px-5 py-2 bg-gray-50 border-t border-b border-gray-100">
                <Text className="text-gray-600 text-xs font-gMedium">
                  Joinable groups
                </Text>
              </View>
              {joinable.map((sc) => (
                <View
                  key={`join-${sc.id}`}
                  className="flex-row items-center px-5 py-4 border-b border-gray-100 bg-white"
                >
                  <View className="w-10 h-10 rounded-full mr-3 items-center justify-center bg-blue-100">
                    <Text className="text-blue-600 font-gBold">
                      {sc.name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-gBold text-gray-900"
                      numberOfLines={1}
                    >
                      {sc.name}
                    </Text>
                    {sc.description ? (
                      <Text className="text-gray-500 text-xs" numberOfLines={1}>
                        {sc.description}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    className="px-3 py-1 rounded-full bg-blue-500"
                    onPress={async () => {
                      try {
                        const uid = currentUser?.uid;
                        if (!uid) return;
                        await updateDoc(doc(db, "subChats", sc.id), {
                          members: arrayUnion(uid),
                        });
                        router.push(
                          `/(user-tabs)/chat/sub-chat?id=${sc.id}` as any
                        );
                      } catch (e) {
                        router.push(
                          `/(user-tabs)/chat/sub-chat?id=${sc.id}` as any
                        );
                      }
                    }}
                  >
                    <Text className="text-white text-xs font-gBold">
                      Join now
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })()}
        ListEmptyComponent={null}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center px-5 py-4 border-b border-gray-100 bg-white active:bg-gray-50"
            onPress={() => {
              // mark as read
              const key =
                item.type === "subchat"
                  ? `subchat_${item.id}`
                  : `campaign_${item.id}`;
              markAsRead(key);
              if (item.type === "subchat") {
                router.push(`/(user-tabs)/chat/sub-chat?id=${item.id}` as any);
              } else {
                router.push(
                  `/(user-tabs)/chat/campaign-chat?campaignId=${item.id}` as any
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
    </SafeAreaView>
  );
}
