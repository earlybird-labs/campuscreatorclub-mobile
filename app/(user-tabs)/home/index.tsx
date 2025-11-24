import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Notifications from "expo-notifications";
import React, { useState, useEffect } from "react";
import { LinkPreview } from "@flyerhq/react-native-link-preview";
import { router } from "expo-router";
import QuoteSvg from "@/assets/svgs/Quote";
import {
  FontAwesome,
  FontAwesome5,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
} from "@react-native-firebase/firestore";
import auth, { getAuth, signOut } from "@react-native-firebase/auth";
import {
  trackAnnouncementViewed,
  trackWebinarJoined,
} from "@/utils/appsFlyerEvents";

interface Announcement {
  id: string;
  title: string;
  content: string;
  photoUrl?: string;
  createdAt: any;
}

interface Webinar {
  id: string;
  title: string;
  date: any;
  startTime: any;
  endTime: any;
  platform: string;
  link: string;
  createdAt: any;
  joined?: string[];
}

interface Campaign {
  id: string;
  title: string;
  date: any;
  type: string;
  reward: string;
  requiredViews: string;
  content: string;
  link: string;
  photoUrl?: string;
  createdAt: any;
  applied?: string[];
  approved?: string[];
  rejected?: string[];
  status?: "active" | "completed";
  completedAt?: any;
}

const HomeScreen = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [userCampaigns, setUserCampaigns] = useState<
    {
      campaign: Campaign;
      status: "applied" | "approved" | "rejected" | "completed";
    }[]
  >([]);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [webinarUsers, setWebinarUsers] = useState<
    Record<string, { name: string; photoUrl?: string }[]>
  >({});
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [announcementModalVisible, setAnnouncementModalVisible] =
    useState(false);

  const db = getFirestore();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Setup push token for server-side notifications
  useEffect(() => {
    const setupPushToken = async () => {
      if (!currentUser) return;

      try {
        // Request notification permissions
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          console.log("Notification permission denied");
          return;
        }

        // Get push token
        const pushToken = await Notifications.getExpoPushTokenAsync({
          projectId: "b1c49196-43d0-4850-8a59-7513499d730c",
        });

        // Update user document with push token
        await updateDoc(doc(db, "users", currentUser.uid), {
          expoPushToken: pushToken.data,
          pushTokenUpdatedAt: new Date(),
        });

        console.log("Push token updated for webinar notifications");
      } catch (error) {
        console.error("Error setting up push token:", error);
      }
    };

    setupPushToken();
  }, [currentUser]);

  // Fetch announcements from Firebase
  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const announcementsData: Announcement[] = [];
      querySnapshot.forEach((doc) => {
        announcementsData.push({
          id: doc.id,
          ...doc.data(),
        } as Announcement);
      });
      setAnnouncements(announcementsData);
    });

    return () => unsubscribe();
  }, []);

  // Fetch webinars from Firebase
  useEffect(() => {
    const q = query(collection(db, "webinars"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const webinarsData: Webinar[] = [];
      querySnapshot.forEach((doc) => {
        webinarsData.push({
          id: doc.id,
          ...doc.data(),
        } as Webinar);
      });
      // Combine date and time for accurate comparison
      function combineDateAndTime(dateObj: Date, timeObj: Date): Date {
        return new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate(),
          timeObj.getHours(),
          timeObj.getMinutes(),
          timeObj.getSeconds()
        );
      }
      type WebinarWithFull = Webinar & { _fullStart: Date; _fullEnd: Date };
      const webinarsWithFull: WebinarWithFull[] = webinarsData.map((w) => {
        const date = w.date.toDate();
        const startTime = w.startTime.toDate();
        const endTime = w.endTime.toDate();
        return {
          ...w,
          _fullStart: combineDateAndTime(date, startTime),
          _fullEnd: combineDateAndTime(date, endTime),
        };
      });
      // Enhanced sort: Live at top, then upcoming (soonest first), then ended (most recent first)
      const now = new Date();
      webinarsWithFull.sort((a, b) => {
        const aIsLive = now >= a._fullStart && now <= a._fullEnd;
        const bIsLive = now >= b._fullStart && now <= b._fullEnd;
        const aIsUpcoming = a._fullStart > now;
        const bIsUpcoming = b._fullStart > now;
        const aIsEnded = a._fullEnd < now;
        const bIsEnded = b._fullEnd < now;

        // Priority 1: Live webinars at the top
        if (aIsLive && !bIsLive) return -1;
        if (!aIsLive && bIsLive) return 1;

        // If both are live, sort by which ends sooner (more urgent first)
        if (aIsLive && bIsLive) {
          return a._fullEnd.getTime() - b._fullEnd.getTime();
        }

        // Priority 2: Upcoming webinars (after live ones)
        if (aIsUpcoming && !bIsUpcoming) return -1;
        if (!aIsUpcoming && bIsUpcoming) return 1;

        // If both are upcoming, sort by start time (soonest first)
        if (aIsUpcoming && bIsUpcoming) {
          return a._fullStart.getTime() - b._fullStart.getTime();
        }

        // Priority 3: Ended webinars (after live and upcoming)
        if (aIsEnded && !bIsEnded) return 1;
        if (!aIsEnded && bIsEnded) return -1;

        // If both are ended, sort by end time (most recent first)
        if (aIsEnded && bIsEnded) {
          return b._fullEnd.getTime() - a._fullEnd.getTime();
        }

        // Fallback: sort by start time
        return a._fullStart.getTime() - b._fullStart.getTime();
      });
      setWebinars(webinarsWithFull);
    });

    return () => unsubscribe();
  }, []);

  // Fetch user's campaigns and status
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userCamps: {
        campaign: Campaign;
        status: "applied" | "approved" | "rejected" | "completed";
      }[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as Campaign;
        let status: "applied" | "approved" | "rejected" | "completed" | null =
          null;

        // Check if campaign is completed and user was involved
        if (
          data.status === "completed" &&
          (data.approved?.includes(currentUser.uid) ||
            data.applied?.includes(currentUser.uid) ||
            data.rejected?.includes(currentUser.uid))
        ) {
          status = "completed";
        } else if (data.approved?.includes(currentUser.uid)) {
          status = "approved";
        } else if (data.rejected?.includes(currentUser.uid)) {
          status = "rejected";
        } else if (data.applied?.includes(currentUser.uid)) {
          status = "applied";
        }

        // Only show campaigns that are not completed
        if (status && status !== "completed") {
          userCamps.push({ campaign: { ...data, id: docSnap.id }, status });
        }
      });
      setUserCampaigns(userCamps);
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // Real-time listener for user data updates
    const unsubscribe = onSnapshot(
      doc(db, "users", currentUser.uid),
      (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserPhotoUrl(userData?.photoUrl || null);
          setUserName(userData?.name || null);
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch user avatars for webinars
  useEffect(() => {
    const fetchWebinarUsers = async () => {
      const userPreviews: Record<
        string,
        { name: string; photoUrl?: string }[]
      > = {};

      for (const webinar of webinars) {
        const joinedUserIds = webinar.joined || [];
        const userPreviewsForWebinar: { name: string; photoUrl?: string }[] =
          [];

        // Fetch first 4 users
        for (let i = 0; i < Math.min(4, joinedUserIds.length); i++) {
          try {
            const userDoc = await getDoc(doc(db, "users", joinedUserIds[i]));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData) {
                userPreviewsForWebinar.push({
                  name: userData.name || "Unknown",
                  photoUrl: userData.photoUrl,
                });
              }
            }
          } catch (error) {
            console.error("Error fetching webinar user preview:", error);
          }
        }

        userPreviews[webinar.id] = userPreviewsForWebinar;
      }

      setWebinarUsers(userPreviews);
    };

    if (webinars.length > 0) {
      fetchWebinarUsers();
    }
  }, [webinars]);

  // Handle webinar join/unjoin
  const handleWebinarJoin = async (webinarId: string, isJoined: boolean) => {
    if (!currentUser) {
      Alert.alert("Error", "You must be logged in to join webinars.");
      return;
    }

    try {
      const webinarRef = doc(db, "webinars", webinarId);

      if (isJoined) {
        // Un-RSVP: Remove user from joined array
        await updateDoc(webinarRef, {
          joined: arrayRemove(currentUser.uid),
        });

        Alert.alert(
          "Un-RSVP Successful",
          "You've been removed from the webinar."
        );
      } else {
        // RSVP: Add user to joined array
        await updateDoc(webinarRef, {
          joined: arrayUnion(currentUser.uid),
        });

        // Track webinar joined
        const webinar = webinars.find((w) => w.id === webinarId);
        trackWebinarJoined(
          currentUser?.uid || null,
          webinarId,
          webinar?.title
        );

        Alert.alert(
          "RSVP Successful!",
          "You've been added to the webinar. You'll receive reminder notifications before it starts!"
        );
      }
    } catch (error) {
      console.error("Error updating webinar join status:", error);
      Alert.alert("Error", "Failed to update join status. Please try again.");
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleAnnouncementPress = (announcement: Announcement) => {
    // Track announcement viewed
    trackAnnouncementViewed(
      currentUser?.uid || null,
      announcement.id,
      announcement.title
    );
    setSelectedAnnouncement(announcement);
    setAnnouncementModalVisible(true);
  };

  const closeAnnouncementModal = () => {
    setAnnouncementModalVisible(false);
    setSelectedAnnouncement(null);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/signin");
          } catch (error) {
            console.error("Error signing out:", error);
            Alert.alert("Error", "Failed to logout. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-1 pt-2">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 mb-5">
          <Text className="font-gBold text-[30px]">Dashboard</Text>
          <View className="flex-row items-center gap-x-2">
            <TouchableOpacity
              onPress={() => router.push("/(user-tabs)/home/feedback")}
              className="p-2"
            >
              <FontAwesome5 name="chalkboard-teacher" size={20} color="black" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(user-tabs)/home/profile")}
              className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 items-center justify-center"
            >
              {userPhotoUrl ? (
                <Image
                  source={{ uri: userPhotoUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : userName ? (
                <Text className="text-white font-gBold text-lg bg-blue-500 w-full h-full text-center leading-10">
                  {userName.charAt(0).toUpperCase()}
                </Text>
              ) : (
                <Ionicons name="person" size={20} color="#6B7280" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          className="px-5"
        >
          {/* Announcements Section */}
          <View className="mb-8">
            <Text className="text-[#8860D2] text-[22px] font-bold mb-4">
              Announcements
            </Text>

            {announcements.length === 0 ? (
              <View className="bg-gray-100 rounded-2xl p-4">
                <Text className="text-gray-500 text-center">
                  No announcements available at the moment.
                </Text>
              </View>
            ) : (
              <FlatList
                data={announcements}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{
                  paddingRight: 20,
                }}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => handleAnnouncementPress(item)}
                    activeOpacity={0.7}
                    className={`bg-purple-100 rounded-2xl p-4 w-96 ${
                      index === 0 ? "" : "ml-4"
                    }`}
                  >
                    <View className="absolute top-2 right-2">
                      <QuoteSvg />
                    </View>
                    <View className="flex-row gap-x-3 pt-1">
                      {item.photoUrl && (
                        <Image
                          source={{ uri: item.photoUrl }}
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 12,
                          }}
                          contentFit="cover"
                        />
                      )}
                      <View className="flex-1">
                        <Text
                          className="font-gBold text-lg text-gray-900 mb-1"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text
                          className="text-gray-600 text-sm leading-5 mb-2"
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {item.content}
                        </Text>
                        <Text className="text-purple-600 text-xs font-gMedium">
                          {formatDate(item.createdAt.toDate())}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* Upcoming Webinars */}
          <View className="mb-8">
            <Text className="text-blue-600 text-[22px] font-bold mb-4">
              Upcoming Webinars
            </Text>

            {webinars.length === 0 ? (
              <View className="bg-gray-100 rounded-2xl p-4">
                <Text className="text-gray-500 text-center">
                  No webinars scheduled at the moment.
                </Text>
              </View>
            ) : (
              <FlatList
                data={webinars}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{
                  paddingBottom: 10,
                }}
                renderItem={({ item, index }) => (
                  <View
                    className={`bg-blue-50 rounded-2xl p-4 ${
                      index === 0 ? "" : "mt-3"
                    }`}
                  >
                    {/* Main Content Row */}
                    <View className="flex-row items-start">
                      {/* Date Box and Join Button */}
                      <View className="items-center mr-2 min-w-[70px]">
                        <View className="items-center mb-2 bg-blue-100 rounded-xl px-3 py-2 min-w-[60px]">
                          <Text className="font-gBold text-2xl text-blue-600">
                            {item.date.toDate().getDate()}
                          </Text>
                          <Text className="text-xs text-blue-600 font-gMedium">
                            {item.date
                              .toDate()
                              .toLocaleDateString("en-US", { month: "short" })
                              .toUpperCase()}
                          </Text>
                        </View>

                        {/* Join/Leave Button */}
                        <TouchableOpacity
                          onPress={() => {
                            const isJoined =
                              item.joined?.includes(currentUser?.uid || "") ||
                              false;
                            handleWebinarJoin(item.id, isJoined);
                          }}
                          className={`px-3 py-2 rounded-lg flex-row items-center ${
                            item.joined?.includes(currentUser?.uid || "")
                              ? "bg-green-100 border border-green-200"
                              : "bg-blue-500"
                          }`}
                        >
                          <>
                            <Ionicons
                              name={
                                item.joined?.includes(currentUser?.uid || "")
                                  ? "checkmark"
                                  : "add"
                              }
                              size={14}
                              color={
                                item.joined?.includes(currentUser?.uid || "")
                                  ? "#059669"
                                  : "white"
                              }
                            />
                            <Text
                              className={`ml-1 font-gMedium text-xs ${
                                item.joined?.includes(currentUser?.uid || "")
                                  ? "text-green-700"
                                  : "text-white"
                              }`}
                            >
                              {item.joined?.includes(currentUser?.uid || "")
                                ? "RSVPD"
                                : "RSVP"}
                            </Text>
                          </>
                        </TouchableOpacity>
                      </View>

                      {/* Content */}
                      <View className="flex-1">
                        <Text
                          className="font-gBold text-lg text-gray-900 mb-3"
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>

                        {/* Time and Platform Badges */}
                        <View className="flex-row items-center gap-2 mb-3">
                          <View className="bg-blue-100 rounded-lg px-3 py-2 flex-row items-center">
                            <Ionicons
                              name="calendar-outline"
                              size={14}
                              color="#3B82F6"
                            />
                            <Text className="ml-1 text-blue-600 font-gMedium text-xs">
                              {formatTime(item.startTime.toDate())} -{" "}
                              {formatTime(item.endTime.toDate())}
                            </Text>
                          </View>

                          <TouchableOpacity
                            disabled={!item.link}
                            onPress={() =>
                              item.link && Linking.openURL(item.link)
                            }
                            className="bg-blue-500 rounded-lg px-3 py-2 flex-row items-center"
                          >
                            <Ionicons name="videocam" size={14} color="white" />
                            <Text className="ml-1 text-white font-gMedium text-xs">
                              {item.platform}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Participant Avatars */}
                        <View className="flex-row justify-between">
                          <View className="flex-row items-center">
                            {(() => {
                              const totalJoined = item.joined?.length || 0;
                              const users = webinarUsers[item.id] || [];

                              if (totalJoined === 0) {
                                return (
                                  <View className="flex-row items-center">
                                    <View className="w-6 h-6 bg-blue-100 rounded-full items-center justify-center">
                                      <Ionicons
                                        name="people"
                                        size={12}
                                        color="#3B82F6"
                                      />
                                    </View>
                                    <Text className="ml-2 text-gray-500 font-gMedium text-xs">
                                      No participants yet
                                    </Text>
                                  </View>
                                );
                              }

                              const displayCount = Math.min(4, totalJoined);
                              const avatars = [];

                              for (let i = 0; i < displayCount; i++) {
                                const user = users[i];
                                avatars.push(
                                  <View
                                    key={user ? user.name : `placeholder-${i}`}
                                    className={`w-6 h-6 rounded-full border border-white overflow-hidden ${
                                      i === 0 ? "" : "-ml-1"
                                    }`}
                                  >
                                    {user && user.photoUrl ? (
                                      <Image
                                        source={{ uri: user.photoUrl }}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                        }}
                                        contentFit="cover"
                                      />
                                    ) : (
                                      <View className="w-full h-full bg-gray-300 items-center justify-center">
                                        {user ? (
                                          <Text className="text-gray-600 font-gBold text-[10px]">
                                            {user.name.charAt(0).toUpperCase()}
                                          </Text>
                                        ) : (
                                          <Ionicons
                                            name="person"
                                            size={10}
                                            color="#6B7280"
                                          />
                                        )}
                                      </View>
                                    )}
                                  </View>
                                );
                              }

                              return (
                                <View className="flex-row items-center">
                                  <View className="flex-row">{avatars}</View>
                                  <Text className="ml-2 text-gray-500 font-gMedium text-xs">
                                    {totalJoined === 1
                                      ? "1 participant"
                                      : `${totalJoined} participants`}
                                  </Text>
                                </View>
                              );
                            })()}
                          </View>
                          {(() => {
                            const now = new Date();
                            const start = (item as any)._fullStart;
                            const end = (item as any)._fullEnd;

                            if (now >= start && now <= end) {
                              // Live badge
                              return (
                                <View className="bg-green-100 px-2 py-1 rounded-lg">
                                  <Text className="text-green-700 text-xs font-gBold">
                                    Live
                                  </Text>
                                </View>
                              );
                            } else if (now < start) {
                              // Up Next badge
                              return (
                                <View className="bg-blue-100 px-2 py-1 rounded-lg">
                                  <Text className="text-blue-700 text-xs font-gBold">
                                    Up Next
                                  </Text>
                                </View>
                              );
                            } else {
                              // Ended badge
                              return (
                                <View className="bg-gray-200 px-2 py-1 rounded-lg">
                                  <Text className="text-gray-600 text-xs font-gBold">
                                    Ended
                                  </Text>
                                </View>
                              );
                            }
                          })()}
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              />
            )}
          </View>

          {/* Campaign Updates Section */}
          <View className="mb-8">
            <Text className="text-gray-700 text-[22px] font-bold mb-4">
              Campaign Updates
            </Text>
            {userCampaigns.length === 0 ? (
              <View className="bg-gray-100 rounded-2xl p-4">
                <Text className="text-gray-500 text-center">
                  You have no campaign activity yet.
                </Text>
              </View>
            ) : (
              <View className="gap-y-3">
                {userCampaigns.map(({ campaign, status }) => (
                  <TouchableOpacity
                    key={campaign.id}
                    onPress={() =>
                      router.push(
                        `/(user-tabs)/campaign/details?id=${campaign.id}`
                      )
                    }
                    activeOpacity={0.7}
                    className="flex-row items-center bg-white border rounded-2xl px-4 py-3"
                    style={{
                      borderColor:
                        status === "applied"
                          ? "#FEF3C7"
                          : status === "approved"
                          ? "#C7D2FE"
                          : "#FECACA",
                    }}
                  >
                    <Text className="text-xl mr-3">🎯</Text>
                    <Text
                      className="flex-1 font-medium text-gray-800"
                      numberOfLines={1}
                    >
                      {campaign.title}
                    </Text>
                    <View
                      className={`px-3 py-1 rounded-lg ml-2 ${
                        status === "applied"
                          ? "bg-amber-50"
                          : status === "approved"
                          ? "bg-indigo-100"
                          : status === "completed"
                          ? "bg-green-100"
                          : "bg-red-100"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          status === "applied"
                            ? "text-amber-500"
                            : status === "approved"
                            ? "text-indigo-600"
                            : status === "completed"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {status === "applied"
                          ? "Applied"
                          : status === "approved"
                          ? "Accepted"
                          : status === "completed"
                          ? "Completed"
                          : "Rejected"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Announcement Modal */}
      <Modal
        visible={announcementModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeAnnouncementModal}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-5">
          <View className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80%]">
            {/* Header with close button */}
            <View className="flex-row justify-between items-start mb-4">
              <Text className="font-gBold text-xl text-gray-900 flex-1 pr-2">
                {selectedAnnouncement?.title}
              </Text>
              <TouchableOpacity
                onPress={closeAnnouncementModal}
                className="p-1"
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Date */}
            <View className="flex-row items-center mb-4">
              <Ionicons name="calendar-outline" size={16} color="#8B5CF6" />
              <Text className="text-purple-600 text-sm font-gMedium ml-2">
                {selectedAnnouncement?.createdAt &&
                  formatDate(selectedAnnouncement.createdAt.toDate())}
              </Text>
            </View>

            {/* Image if available */}
            {selectedAnnouncement?.photoUrl && (
              <Image
                source={{ uri: selectedAnnouncement.photoUrl }}
                style={{
                  width: "100%",
                  height: 192,
                  borderRadius: 12,
                  marginBottom: 12,
                }}
                contentFit="cover"
              />
            )}

            {/* Content */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              className="max-h-60"
            >
              <Text className="text-gray-700 text-base leading-6">
                {selectedAnnouncement?.content}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default HomeScreen;
