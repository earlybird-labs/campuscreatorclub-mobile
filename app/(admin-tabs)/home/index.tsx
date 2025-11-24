import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import React, { useState, useEffect } from "react";
import {
  FontAwesome,
  FontAwesome5,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import DatePicker from "react-native-date-picker";
import QuoteSvg from "@/assets/svgs/Quote";
import { router } from "expo-router";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth, { getAuth, signOut } from "@react-native-firebase/auth";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";

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

const home = () => {
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showWebinarModal, setShowWebinarModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<"start" | "end">(
    "start"
  );
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [editingWebinar, setEditingWebinar] = useState<Webinar | null>(null);
  const [user, setUser] = useState<any>(null);
  const [webinarUsers, setWebinarUsers] = useState<
    Record<string, { name: string; photoUrl?: string }[]>
  >({});
  const [announcementModalVisible, setAnnouncementModalVisible] =
    useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);

  const [announcementData, setAnnouncementData] = useState({
    title: "",
    content: "",
    photo: null,
  });

  const [webinarData, setWebinarData] = useState({
    title: "",
    date: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    platform: "",
    link: "",
  });

  const db = getFirestore();
  const auth = getAuth();

  const platforms = [
    "Zoom",
    "Google Meet",
    "Microsoft Teams",
    "WebEx",
    "Discord",
    "Instagram Live",
    "Other",
  ];

  // Fetch current user data from Firestore with real-time updates
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Real-time listener for user data updates
    const unsubscribe = onSnapshot(
      doc(db, "users", currentUser.uid),
      (userDoc) => {
        if (userDoc.exists()) {
          setUser(userDoc.data());
        }
      }
    );

    return () => unsubscribe();
  }, [auth.currentUser]);

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
      // Extend Webinar type locally to include _fullStart and _fullEnd
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

  // Request image permissions
  const requestImagePermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Sorry, we need camera roll permissions to upload images!"
      );
      return false;
    }
    return true;
  };

  // Pick image from gallery
  const pickImage = async () => {
    const hasPermission = await requestImagePermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  // Upload image to Firebase Storage (React Native Firebase)
  const uploadImage = async (uri: string): Promise<string> => {
    // If it's already a remote URL, skip upload
    if (uri.startsWith("http")) {
      return uri;
    }

    const filename = `announcements/${Date.now()}.jpg`;
    const reference = storage().ref(filename);
    await reference.putFile(uri);
    const downloadUrl = await reference.getDownloadURL();
    return downloadUrl;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementData.title.trim()) {
      Alert.alert("Error", "Please enter an announcement title");
      return;
    }

    setUploading(true);
    try {
      let photoUrl = "";

      // Upload image if selected
      if (selectedImage) {
        photoUrl = await uploadImage(selectedImage);
      }

      if (editingAnnouncement) {
        // Update existing announcement
        await updateDoc(doc(db, "announcements", editingAnnouncement.id), {
          title: announcementData.title,
          content: announcementData.content,
          ...(selectedImage && { photoUrl }),
          updatedAt: new Date(),
        });
        Alert.alert("Success", "Announcement updated successfully!");
      } else {
        // Create new announcement
        const announcementDocRef = await addDoc(
          collection(db, "announcements"),
          {
            title: announcementData.title,
            content: announcementData.content,
            photoUrl: photoUrl,
            createdAt: new Date(),
          }
        );

        // Announcement notifications will be sent automatically via Cloud Function
        console.log(
          "Announcement created successfully - notifications will be sent via Cloud Function"
        );

        Alert.alert("Success", "Announcement created successfully!");
      }

      // Reset form
      setShowAnnouncementModal(false);
      setAnnouncementData({ title: "", content: "", photo: null });
      setSelectedImage(null);
      setEditingAnnouncement(null);
    } catch (error) {
      console.error("Error creating/updating announcement:", error);
      Alert.alert("Error", "Failed to save announcement. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementData({
      title: announcement.title,
      content: announcement.content,
      photo: null,
    });
    if (announcement.photoUrl) {
      setSelectedImage(announcement.photoUrl);
    }
    setShowAnnouncementModal(true);
  };

  const handleDeleteAnnouncement = (announcementId: string) => {
    Alert.alert(
      "Delete Announcement",
      "Are you sure you want to delete this announcement? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "announcements", announcementId));
              Alert.alert("Success", "Announcement deleted successfully!");
            } catch (error) {
              console.error("Error deleting announcement:", error);
              Alert.alert(
                "Error",
                "Failed to delete announcement. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const resetAnnouncementModal = () => {
    setShowAnnouncementModal(false);
    setSelectedImage(null);
    setAnnouncementData({ title: "", content: "", photo: null });
    setEditingAnnouncement(null);
  };

  const handleCreateWebinar = async () => {
    if (!webinarData.title.trim()) {
      Alert.alert("Error", "Please enter a webinar title");
      return;
    }

    setUploading(true);
    try {
      if (editingWebinar) {
        // Update existing webinar
        await updateDoc(doc(db, "webinars", editingWebinar.id), {
          title: webinarData.title,
          date: webinarData.date,
          startTime: webinarData.startTime,
          endTime: webinarData.endTime,
          platform: webinarData.platform,
          link: webinarData.link,
          updatedAt: new Date(),
        });
        Alert.alert("Success", "Webinar updated successfully!");
      } else {
        // Create new webinar
        await addDoc(collection(db, "webinars"), {
          title: webinarData.title,
          date: webinarData.date,
          startTime: webinarData.startTime,
          endTime: webinarData.endTime,
          platform: webinarData.platform,
          link: webinarData.link,
          createdAt: new Date(),
        });

        Alert.alert(
          "Success",
          "Webinar created successfully! Notifications will be sent automatically."
        );
      }

      // Reset form
      setShowWebinarModal(false);
      setWebinarData({
        title: "",
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        platform: "",
        link: "",
      });
      setEditingWebinar(null);
    } catch (error) {
      console.error("Error creating/updating webinar:", error);
      Alert.alert("Error", "Failed to save webinar. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleEditWebinar = (webinar: Webinar) => {
    setEditingWebinar(webinar);
    setWebinarData({
      title: webinar.title,
      date: webinar.date.toDate(),
      startTime: webinar.startTime.toDate(),
      endTime: webinar.endTime.toDate(),
      platform: webinar.platform,
      link: webinar.link,
    });
    setShowWebinarModal(true);
  };

  const handleDeleteWebinar = (webinarId: string) => {
    Alert.alert(
      "Delete Webinar",
      "Are you sure you want to delete this webinar? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "webinars", webinarId));
              Alert.alert("Success", "Webinar deleted successfully!");
            } catch (error) {
              console.error("Error deleting webinar:", error);
              Alert.alert(
                "Error",
                "Failed to delete webinar. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const resetWebinarModal = () => {
    setShowWebinarModal(false);
    setWebinarData({
      title: "",
      date: new Date(),
      startTime: new Date(),
      endTime: new Date(),
      platform: "",
      link: "",
    });
    setEditingWebinar(null);
  };

  const closeAnnouncementModal = () => {
    setAnnouncementModalVisible(false);
    setSelectedAnnouncement(null);
  };

  const handleAnnouncementPress = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setAnnouncementModalVisible(true);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-1 pt-2">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 mb-5">
          <Text className="font-gBold text-[30px]">Dashboard</Text>
          <View className="flex-row items-center gap-x-2">
            <TouchableOpacity
              onPress={() => router.push("/(admin-tabs)/home/feedback")}
              className="p-2"
            >
              <FontAwesome5 name="chalkboard-teacher" size={20} color="black" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(admin-tabs)/home/profile")}
              className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 items-center justify-center"
            >
              {user?.photoUrl || auth.currentUser?.photoURL ? (
                <Image
                  source={{
                    uri: user?.photoUrl || auth.currentUser?.photoURL,
                  }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : user?.name ? (
                <View className="bg-blue-500 w-full h-full items-center justify-center">
                  <Text className="text-white font-gBold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
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
          {/* Action Buttons */}
          <View className="gap-y-4 mb-8">
            <TouchableOpacity
              onPress={() => setShowAnnouncementModal(true)}
              className="bg-purple-400 rounded-2xl px-6 py-4 items-center"
            >
              <Text className="font-gBold text-lg text-white">
                Add Announcement
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowWebinarModal(true)}
              className="bg-blue-400 rounded-2xl px-6 py-4 items-center"
            >
              <Text className="font-gBold text-lg text-white">Add Webinar</Text>
            </TouchableOpacity>
          </View>

          {/* Announcements Section */}
          <View className="mb-8">
            <Text className="text-[#8860D2] text-[22px] font-bold mb-4">
              Announcements
            </Text>

            {announcements.length === 0 ? (
              <View className="bg-gray-100 rounded-2xl p-4">
                <Text className="text-gray-500 text-center">
                  No announcements yet. Create your first announcement!
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
                    className={`bg-purple-100 rounded-2xl p-4 w-96 ${
                      index === 0 ? "" : "ml-4"
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center gap-x-2">
                        <QuoteSvg />

                        <Text className="text-purple-600 text-xs font-gMedium">
                          {formatDate(item.createdAt.toDate())}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-x-2">
                        <TouchableOpacity
                          onPress={() => handleEditAnnouncement(item)}
                          className="p-2 bg-purple-400/20 rounded-lg"
                        >
                          <Ionicons name="create" size={18} color="#8860D2" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteAnnouncement(item.id)}
                          className="p-2 bg-purple-400/20 rounded-lg"
                        >
                          <Ionicons name="trash" size={18} color="#8860D2" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View className="flex-row gap-x-3">
                      {item.photoUrl && (
                        <Image
                          source={{ uri: item.photoUrl }}
                          style={{ width: 64, height: 64, borderRadius: 12 }}
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
                          className="text-gray-600 text-sm leading-5"
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {item.content}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* User Reviews Section */}
          {/* <View className="mb-8">
            <Text className="font-gBold text-xl text-gray-900 mb-4">
              User Reviews
            </Text>
            <View className="flex-row gap-x-4 mb-4">
              <View className="flex-1 bg-gray-50 rounded-2xl p-4">
                <View className="flex-row items-center mb-3">
                  <Image
                    source={{
                      uri: "https://randomuser.me/api/portraits/women/35.jpg",
                    }}
                    style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                  />
                  <View className="flex-1">
                    <Text className="font-gBold text-lg">Zara Yasmin</Text>
                    <Text className="text-gray-500">Harvard university</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={16} color="#FFA500" />
                    <Text className="ml-1 font-gMedium text-orange-500">
                      5.0
                    </Text>
                  </View>
                </View>
                <Text className="text-gray-600 text-sm">
                  Loved working on this collab! The product was fun to shoot and
                  easy to style — super happy with how the content turned out...
                </Text>
              </View>
            </View>

            <TouchableOpacity className="flex-row items-center bg-gray-100 rounded-2xl px-4 py-3">
              <Text className="text-4xl mr-4">💬</Text>
              <Text className="font-gMedium text-lg text-gray-700">
                Add Review
              </Text>
            </TouchableOpacity>
          </View> */}

          {/* Upcoming Webinars */}
          <View className="mb-8">
            <Text className="text-blue-600 text-[22px] font-bold mb-4">
              Upcoming Webinars
            </Text>

            {webinars.length === 0 ? (
              <View className="bg-gray-100 rounded-2xl p-4">
                <Text className="text-gray-500 text-center">
                  No webinars scheduled yet. Create your first webinar!
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
                renderItem={({ item, index }) => {
                  const date = item.date.toDate();
                  const startTime = item.startTime.toDate();
                  const endTime = item.endTime.toDate();
                  const start = (item as any)._fullStart;
                  const end = (item as any)._fullEnd;
                  const now = new Date();

                  return (
                    <View
                      className={`bg-blue-50 rounded-2xl p-4 ${
                        index === 0 ? "" : "mt-3"
                      }`}
                    >
                      {/* Main Content Row */}
                      <View className="flex-row items-start mb-4">
                        {/* Date Box */}
                        <View className="items-center mr-4 bg-blue-100 rounded-xl px-3 py-2 min-w-[60px]">
                          <Text className="font-gBold text-2xl text-blue-600">
                            {date.getDate()}
                          </Text>
                          <Text className="text-xs text-blue-600 font-gMedium">
                            {date
                              .toLocaleDateString("en-US", { month: "short" })
                              .toUpperCase()}
                          </Text>
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
                          <View className="flex-row items-center gap-3 mb-3">
                            <View className="bg-blue-100 rounded-lg px-3 py-2 flex-row items-center">
                              <Ionicons
                                name="calendar-outline"
                                size={16}
                                color="#3B82F6"
                              />
                              <Text className="ml-1 text-blue-600 font-gMedium text-sm">
                                {formatTime(startTime)} - {formatTime(endTime)}
                              </Text>
                            </View>

                            <TouchableOpacity
                              disabled={!item.link}
                              onPress={() =>
                                item.link && Linking.openURL(item.link)
                              }
                              className="bg-blue-500 rounded-lg px-3 py-2 flex-row items-center max-w-[120px]"
                            >
                              <Ionicons
                                name="videocam"
                                size={16}
                                color="white"
                              />
                              <Text
                                className="ml-1 text-white font-gMedium text-sm flex-shrink max-w-[80px]"
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {item.platform}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Participant Avatars */}

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
                        </View>
                      </View>

                      {/* Edit/Delete Buttons at Bottom Right */}
                      <View className="flex-row justify-between">
                        {(() => {
                          if (now >= start && now <= end) {
                            // Live badge
                            return (
                              <View className="bg-green-100 px-2 py-1 rounded-lg justify-center">
                                <Text className="text-green-700 text-xs font-gBold">
                                  Live
                                </Text>
                              </View>
                            );
                          } else if (now < start) {
                            // Up Next badge
                            return (
                              <View className="bg-blue-100 px-2 py-1 rounded-lg justify-center">
                                <Text className="text-blue-700 text-xs font-gBold">
                                  Up Next
                                </Text>
                              </View>
                            );
                          } else {
                            // Ended badge
                            return (
                              <View className="bg-gray-200 px-2 py-1 rounded-lg justify-center">
                                <Text className="text-gray-600 text-xs font-gBold">
                                  Ended
                                </Text>
                              </View>
                            );
                          }
                        })()}

                        <View className="flex-row ">
                          <View className="flex-row items-center gap-x-2">
                            <TouchableOpacity
                              onPress={() => handleEditWebinar(item)}
                              className="p-2 bg-blue-200/60 rounded-lg"
                            >
                              <Ionicons
                                name="create"
                                size={16}
                                color="#3B82F6"
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteWebinar(item.id)}
                              className="p-2 bg-blue-200/60 rounded-lg"
                            >
                              <Ionicons
                                name="trash"
                                size={16}
                                color="#3B82F6"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </ScrollView>
      </View>

      {/* Create Announcement Modal */}
      <Modal
        visible={showAnnouncementModal}
        animationType="slide"
        transparent={true}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-[90%]">
              <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                <Text className="text-2xl font-gBold text-gray-900">
                  {editingAnnouncement
                    ? "Edit Announcement"
                    : "Create Announcement"}
                </Text>
                <TouchableOpacity
                  onPress={resetAnnouncementModal}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 px-6">
                {/* Photo Upload */}
                <TouchableOpacity
                  className="bg-gray-50 rounded-2xl p-8 items-center justify-center my-6 min-h-[120px] border-2 border-dashed border-gray-200"
                  onPress={pickImage}
                >
                  {selectedImage ? (
                    <Image
                      source={{ uri: selectedImage }}
                      className="w-full h-32 rounded-xl"
                      contentFit="cover"
                    />
                  ) : (
                    <>
                      <View className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center mb-3">
                        <Ionicons
                          name="image-outline"
                          size={24}
                          color="#3B82F6"
                        />
                      </View>
                      <Text className="text-lg font-gMedium text-gray-600 text-center">
                        {editingAnnouncement
                          ? "Change photo"
                          : "Upload a\nannouncement photo"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Announcement Title */}
                <View className="mb-6">
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="Announcement title"
                    value={announcementData.title}
                    onChangeText={(text) =>
                      setAnnouncementData({ ...announcementData, title: text })
                    }
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Announcement Content */}
                <View className="mb-8">
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="Announcement content"
                    value={announcementData.content}
                    onChangeText={(text) =>
                      setAnnouncementData({
                        ...announcementData,
                        content: text,
                      })
                    }
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </ScrollView>

              <View className="p-6 border-t border-gray-100">
                <TouchableOpacity
                  className={`rounded-2xl py-4 items-center justify-center ${
                    uploading ? "bg-gray-400" : "bg-blue-500"
                  }`}
                  onPress={handleCreateAnnouncement}
                  disabled={uploading}
                >
                  <Text className="text-white text-lg font-gBold">
                    {uploading
                      ? editingAnnouncement
                        ? "Updating..."
                        : "Creating..."
                      : editingAnnouncement
                      ? "Update Announcement"
                      : "Create Announcement"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Webinar Modal */}
      <Modal
        visible={showWebinarModal}
        animationType="slide"
        transparent={true}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-[90%]">
              <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                <Text className="text-2xl font-gBold text-gray-900">
                  {editingWebinar ? "Edit Webinar" : "Create Webinar"}
                </Text>
                <TouchableOpacity
                  onPress={resetWebinarModal}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 px-6">
                {/* Webinar Title */}
                <View className="mt-6 mb-6">
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="Webinar title"
                    value={webinarData.title}
                    onChangeText={(text) =>
                      setWebinarData({ ...webinarData, title: text })
                    }
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Pick Date */}
                <View className="mb-6">
                  <TouchableOpacity
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex-row items-center justify-between"
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text
                      className={`text-base ${
                        webinarData.date ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {webinarData.date
                        ? formatDate(webinarData.date)
                        : "Pick a Date"}
                    </Text>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>

                {/* Start and End Time */}
                <View className="mb-6 flex-row gap-x-3">
                  <View className="flex-1">
                    <Text className="text-gray-600 text-sm mb-2">
                      Start Time
                    </Text>
                    <TouchableOpacity
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex-row items-center justify-between"
                      onPress={() => {
                        setTimePickerType("start");
                        setShowTimePicker(true);
                      }}
                    >
                      <Text className="text-base text-gray-900">
                        {formatTime(webinarData.startTime)}
                      </Text>
                      <Ionicons name="time-outline" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-1">
                    <Text className="text-gray-600 text-sm mb-2">End Time</Text>
                    <TouchableOpacity
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex-row items-center justify-between"
                      onPress={() => {
                        setTimePickerType("end");
                        setShowTimePicker(true);
                      }}
                    >
                      <Text className="text-base text-gray-900">
                        {formatTime(webinarData.endTime)}
                      </Text>
                      <Ionicons name="time-outline" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Conference Platform */}
                <View className="mb-6">
                  <TouchableOpacity
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex-row items-center justify-between"
                    onPress={() =>
                      setShowPlatformDropdown(!showPlatformDropdown)
                    }
                  >
                    <Text
                      className={`text-base ${
                        webinarData.platform ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {webinarData.platform || "Conference Platform"}
                    </Text>
                    <Ionicons
                      name={
                        showPlatformDropdown ? "chevron-up" : "chevron-down"
                      }
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>

                  {showPlatformDropdown && (
                    <View className="bg-white border border-gray-200 rounded-xl mt-2 shadow-sm">
                      {platforms.map((platform, index) => (
                        <TouchableOpacity
                          key={index}
                          className="px-4 py-3 border-b border-gray-100 last:border-b-0"
                          onPress={() => {
                            setWebinarData({ ...webinarData, platform });
                            setShowPlatformDropdown(false);
                          }}
                        >
                          <Text className="text-base text-gray-900">
                            {platform}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Conference Link */}
                <View className="mb-8">
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="Conference link"
                    value={webinarData.link}
                    onChangeText={(text) =>
                      setWebinarData({ ...webinarData, link: text })
                    }
                    keyboardType="url"
                    autoCapitalize="none"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </ScrollView>

              <View className="p-6 border-t border-gray-100">
                <TouchableOpacity
                  className={`rounded-2xl py-4 items-center justify-center ${
                    uploading ? "bg-gray-400" : "bg-blue-500"
                  }`}
                  onPress={handleCreateWebinar}
                  disabled={uploading}
                >
                  <Text className="text-white text-lg font-gBold">
                    {uploading
                      ? editingWebinar
                        ? "Updating..."
                        : "Creating..."
                      : editingWebinar
                      ? "Update Webinar"
                      : "Create Webinar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                className="w-full h-48 rounded-xl mb-4"
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

      {/* Date Picker */}
      <DatePicker
        modal
        mode="date"
        open={showDatePicker}
        date={webinarData.date}
        onConfirm={(date) => {
          setShowDatePicker(false);
          setWebinarData({ ...webinarData, date });
        }}
        onCancel={() => {
          setShowDatePicker(false);
        }}
      />

      {/* Time Picker */}
      <DatePicker
        modal
        mode="time"
        open={showTimePicker}
        date={
          timePickerType === "start"
            ? webinarData.startTime
            : webinarData.endTime
        }
        onConfirm={(time) => {
          setShowTimePicker(false);
          if (timePickerType === "start") {
            setWebinarData({ ...webinarData, startTime: time });
          } else {
            setWebinarData({ ...webinarData, endTime: time });
          }
        }}
        onCancel={() => {
          setShowTimePicker(false);
        }}
      />
    </SafeAreaView>
  );
};

export default home;
