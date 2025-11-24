import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import React, { useState, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  where,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { router } from "expo-router";
import DollarSvg from "@/assets/svgs/DollarIcon";
import CalenderSvg from "@/assets/svgs/CalenderIcon";
import {
  trackCampaignViewed,
  trackCampaignApplied,
} from "@/utils/appsFlyerEvents";

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
  applied?: string[]; // Array of user IDs who applied
  approved?: string[]; // Array of user IDs who approved
  rejected?: string[]; // Array of user IDs who rejected
  brandColor?: string;
  status?: "active" | "inprogress" | "completed";
  completedAt?: any;
  applicantCap?: number; // Maximum number of applicants allowed
  isAmbassadorProgram?: boolean; // Flag for ambassador program campaigns
}

interface SubChat {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  createdAt: any;
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

const campaign = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [appliedCampaigns, setAppliedCampaigns] = useState<Set<string>>(
    new Set()
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userAvatars, setUserAvatars] = useState<
    Record<string, { name: string; photoUrl?: string }[]>
  >({});
  const [activeTab, setActiveTab] = useState<
    "upcoming" | "inprogress" | "completed"
  >("upcoming");

  // View mode state (Campaigns vs Ambassador Programs)
  const [viewMode, setViewMode] = useState<"campaigns" | "ambassador">(
    "campaigns"
  );

  // Filter modal state
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Sub-chats state
  const [subChatsModalVisible, setSubChatsModalVisible] = useState(false);
  const [subChats, setSubChats] = useState<SubChat[]>([]);
  const [allChats, setAllChats] = useState<ChatItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  const db = getFirestore();
  const auth = getAuth();

  // Get current user ID
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUserId(user.uid);
    }
  }, []);

  // Fetch campaigns from Firebase
  useEffect(() => {
    const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const campaignsData: Campaign[] = [];
      const userAppliedSet = new Set<string>();

      querySnapshot.forEach((doc) => {
        const campaignData = {
          id: doc.id,
          ...doc.data(),
        } as Campaign;

        campaignsData.push(campaignData);

        // Check if current user has applied to this campaign
        if (currentUserId && campaignData.applied?.includes(currentUserId)) {
          userAppliedSet.add(campaignData.id);
        }
      });

      setCampaigns(campaignsData);
      setAppliedCampaigns(userAppliedSet);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  // Fetch sub-chats where user is a member
  useEffect(() => {
    if (!currentUserId) return;

    setLoadingChats(true);
    const q = query(
      collection(db, "subChats"),
      where("members", "array-contains", currentUserId)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!querySnapshot) {
          setSubChats([]);
          setLoadingChats(false);
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
        setLoadingChats(false);
      },
      (error) => {
        console.error("Error fetching user sub-chats:", error);
        setSubChats([]);
        setLoadingChats(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  // Combine sub-chats and approved campaigns into unified chat list
  useEffect(() => {
    if (!currentUserId) {
      setAllChats([]);
      return;
    }

    const chatItems: ChatItem[] = [];

    // Add sub-chats
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

    // Add approved campaigns (exclude completed campaigns)
    campaigns.forEach((camp) => {
      if (camp.approved?.includes(currentUserId)) {
        // Only show campaigns that are not completed
        const isNotCompleted = !camp.status || camp.status !== "completed";

        if (isNotCompleted) {
          chatItems.push({
            id: camp.id,
            name: camp.title,
            description: camp.content,
            type: "campaign",
            members: camp.approved,
            createdAt: camp.createdAt,
            photoUrl: camp.photoUrl, // Add campaign image
          });
        }
      }
    });

    // Sort by creation date (newest first)
    chatItems.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.seconds - a.createdAt.seconds;
    });

    setAllChats(chatItems);
  }, [subChats, campaigns, currentUserId]);

  // Fetch up to 4 real user avatars for each campaign
  useEffect(() => {
    const fetchAvatars = async () => {
      const avatarsMap: Record<string, { name: string; photoUrl?: string }[]> =
        {};
      for (const camp of campaigns) {
        const allUserIds = [
          ...(camp.approved || []),
          ...(camp.applied || []),
          ...(camp.rejected || []),
        ];
        const uniqueUserIds = [...new Set(allUserIds)].slice(0, 4);
        const avatarList: { name: string; photoUrl?: string }[] = [];
        for (const userId of uniqueUserIds) {
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData) {
                avatarList.push({
                  name: userData.name || "?",
                  photoUrl: userData.photoUrl,
                });
              }
            }
          } catch {}
        }
        avatarsMap[camp.id] = avatarList;
      }
      setUserAvatars(avatarsMap);
    };
    if (campaigns.length > 0) fetchAvatars();
  }, [campaigns]);

  // Handle campaign application
  const handleApplyCampaign = async (campaignId: string) => {
    if (!currentUserId) {
      Alert.alert("Error", "You must be logged in to apply for campaigns.");
      return;
    }

    if (appliedCampaigns.has(campaignId)) {
      Alert.alert(
        "Already Applied",
        "You have already applied to this campaign."
      );
      return;
    }

    try {
      const campaignRef = doc(db, "campaigns", campaignId);

      // Get current campaign data to check if user was rejected
      const campaignDoc = await getDoc(campaignRef);
      const campaignData = campaignDoc.data();
      const wasRejected = campaignData?.rejected?.includes(currentUserId);

      // Check applicant cap
      if (campaignData?.applicantCap) {
        const currentApplications = campaignData.applied?.length || 0;
        if (currentApplications >= campaignData.applicantCap) {
          Alert.alert(
            "Campaign Full",
            `This campaign has reached its maximum of ${campaignData.applicantCap} applicants. Please check back later or explore other campaigns.`,
            [{ text: "OK" }]
          );
          return;
        }
      }

      // Prepare update object
      const updateData: any = {
        applied: arrayUnion(currentUserId),
      };

      // If user was previously rejected, remove them from rejected array
      if (wasRejected) {
        updateData.rejected = arrayRemove(currentUserId);
      }

      // Update the campaign document
      await updateDoc(campaignRef, updateData);

      // Update local state
      setAppliedCampaigns((prev) => new Set([...prev, campaignId]));

      // Track campaign application for AppsFlyer
      trackCampaignApplied(
        currentUserId,
        campaignId,
        campaignData?.title,
        campaignData?.type
      );

      // Show appropriate success message
      const message = wasRejected
        ? "Your reapplication has been submitted successfully!"
        : "Your application has been submitted successfully!";

      Alert.alert("Application Submitted", message);

      // Redirect to campaign link if it exists
      if (campaignData?.link) {
        const url = campaignData.link.startsWith("http")
          ? campaignData.link
          : `https://${campaignData.link}`;
        Linking.openURL(url).catch((err) => {
          console.error("Error opening campaign link:", err);
          Alert.alert("Error", "Could not open the campaign link.");
        });
      }
    } catch (error) {
      console.error("Error applying to campaign:", error);
      Alert.alert("Error", "Failed to apply to campaign. Please try again.");
    }
  };

  // Handle campaign unapplication
  const handleUnapplyCampaign = async (
    campaignId: string,
    campaignTitle: string
  ) => {
    if (!currentUserId) {
      Alert.alert("Error", "You must be logged in to unapply from campaigns.");
      return;
    }

    if (!appliedCampaigns.has(campaignId)) {
      Alert.alert("Error", "You haven't applied to this campaign.");
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      "Undo Application",
      `Are you sure you want to withdraw your application for "${campaignTitle}"? You can reapply later if you change your mind.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            try {
              const campaignRef = doc(db, "campaigns", campaignId);

              // Remove user ID from the applied array
              await updateDoc(campaignRef, {
                applied: arrayRemove(currentUserId),
              });

              // Update local state
              setAppliedCampaigns((prev) => {
                const newSet = new Set(prev);
                newSet.delete(campaignId);
                return newSet;
              });

              Alert.alert(
                "Application Withdrawn",
                "Your application has been successfully withdrawn. You can reapply anytime."
              );
            } catch (error) {
              console.error("Error unapplying from campaign:", error);
              Alert.alert(
                "Error",
                "Failed to withdraw application. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  // Format large numbers into readable format (1k, 100k, 1M, etc.)
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

  // Gradient colors array for variety
  const gradientColors = [
    ["#dbeafe", "#c7d2fe"], // Blue
    ["#fef3c7", "#fde68a"], // Yellow/Orange
    ["#ede9fe", "#ddd6fe"], // Purple
    ["#dbeafe", "#bae6fd"], // Light Blue
    ["#fce7f3", "#fbcfe8"], // Pink
    ["#d1fae5", "#a7f3d0"], // Green
  ];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-1 pt-2">
        <View className="flex-row items-center justify-between px-5 mb-5">
          <Text className="font-gBold text-[28px]">
            {/* {viewMode === "campaigns" ? "Campaigns" : "Ambassador Programs"} */}
            Campaigns
          </Text>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => setFilterModalVisible(true)}
              className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
            >
              <Ionicons name="filter" size={18} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSubChatsModalVisible(true)}
              className="w-10 h-10 bg-blue-500 rounded-full items-center justify-center shadow-sm"
            >
              <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* View Mode Toggle */}
        <View className="px-5 mb-4">
          <View className="flex-row bg-gray-100 rounded-full p-1">
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 25,
                alignItems: "center",
                backgroundColor:
                  viewMode === "campaigns" ? "#ffffff" : "transparent",
                shadowOpacity: viewMode === "campaigns" ? 0.1 : 0,
                shadowRadius: viewMode === "campaigns" ? 4 : 0,
                elevation: viewMode === "campaigns" ? 2 : 0,
              }}
              onPress={() => setViewMode("campaigns")}
            >
              <Text
                style={{
                  fontWeight: "600",
                  color: viewMode === "campaigns" ? "#2563EB" : "#6B7280",
                }}
              >
                Campaigns
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 25,
                alignItems: "center",
                backgroundColor:
                  viewMode === "ambassador" ? "#ffffff" : "transparent",
                shadowOpacity: viewMode === "ambassador" ? 0.1 : 0,
                shadowRadius: viewMode === "ambassador" ? 4 : 0,
                elevation: viewMode === "ambassador" ? 2 : 0,
              }}
              onPress={() => setViewMode("ambassador")}
            >
              <Text
                style={{
                  fontWeight: "600",
                  color: viewMode === "ambassador" ? "#2563EB" : "#6B7280",
                }}
              >
                Ambassador Programs
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {(() => {
          const filteredCampaigns = campaigns.filter((campaign) => {
            // First filter by view mode (Campaigns vs Ambassador Programs)
            if (viewMode === "ambassador") {
              // Only show campaigns that are ambassador programs
              if (!campaign.isAmbassadorProgram) return false;
            } else {
              // Only show regular campaigns (not ambassador programs)
              if (campaign.isAmbassadorProgram) return false;
            }

            // Then filter by status tab
            if (activeTab === "upcoming") {
              // Show all campaigns that are active (default status) or don't have a status set
              return !campaign.status || campaign.status === "active";
            } else if (activeTab === "inprogress") {
              // Show only campaigns manually marked as "inprogress"
              return campaign.status === "inprogress";
            } else {
              // Completed tab: show only campaigns manually marked as "completed"
              return campaign.status === "completed";
            }
          });

          // Sort campaigns by scheduled date (earliest first)
          filteredCampaigns.sort((a, b) => {
            // Handle case where date might be a Firestore timestamp or Date object
            const dateA = a.date?.seconds
              ? new Date(a.date.seconds * 1000)
              : new Date(a.date);
            const dateB = b.date?.seconds
              ? new Date(b.date.seconds * 1000)
              : new Date(b.date);
            return dateA.getTime() - dateB.getTime();
          });

          if (filteredCampaigns.length === 0) {
            return (
              <View className="flex-1 justify-center items-center px-5">
                <Text className="text-gray-500 text-center text-lg">
                  {viewMode === "ambassador"
                    ? activeTab === "upcoming"
                      ? "No active ambassador programs available."
                      : activeTab === "inprogress"
                      ? "No ambassador programs in progress."
                      : "No completed ambassador programs."
                    : activeTab === "upcoming"
                    ? "No active campaigns available at the moment."
                    : activeTab === "inprogress"
                    ? "No campaigns in progress."
                    : "No completed campaigns yet."}
                </Text>
                <Text className="text-gray-400 text-center mt-2">
                  {viewMode === "ambassador"
                    ? "Ambassador programs will appear here when available."
                    : activeTab === "upcoming"
                    ? "Check back later for new opportunities!"
                    : activeTab === "inprogress"
                    ? "Campaigns in progress will appear here."
                    : "Completed campaigns will appear here."}
                </Text>
              </View>
            );
          }

          return (
            <ScrollView
              contentContainerStyle={{
                paddingBottom: 30,
                paddingHorizontal: 10,
              }}
              showsVerticalScrollIndicator={false}
              className="px-2"
            >
              {filteredCampaigns.map((campaign, idx) => {
                const hasApplied = appliedCampaigns.has(campaign.id);
                const allUserIds = [
                  ...(campaign.approved || []),
                  ...(campaign.applied || []),
                  ...(campaign.rejected || []),
                ];
                const uniqueUserIds = [...new Set(allUserIds)];
                const applicantCount = uniqueUserIds.length;
                // Only show approved users
                const approvedUserIds = campaign.approved || [];
                const avatars = (userAvatars[campaign.id] || []).filter(
                  (_, idx) => idx < 3
                );
                const approvedCount = approvedUserIds.length;
                const remainingCount = approvedCount - avatars.length;

                // Determine user status
                let userStatus: "approved" | "pending" | "rejected" | null =
                  null;
                if (currentUserId && campaign.approved?.includes(currentUserId))
                  userStatus = "approved";
                else if (
                  currentUserId &&
                  campaign.rejected?.includes(currentUserId)
                )
                  userStatus = "rejected";
                else if (
                  currentUserId &&
                  campaign.applied?.includes(currentUserId)
                )
                  userStatus = "pending";

                return (
                  <TouchableOpacity
                    key={campaign.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      // Track campaign viewed
                      trackCampaignViewed(
                        currentUserId,
                        campaign.id,
                        campaign.title
                      );
                      router.push({
                        pathname: "/campaign/details",
                        params: { id: campaign.id },
                      });
                    }}
                    style={{
                      borderRadius: 24,
                      marginBottom: 20,
                      padding: 18,
                      flexDirection: "column",
                      backgroundColor:
                        campaign.brandColor ||
                        gradientColors[idx % gradientColors.length][0],
                      shadowColor: "#000",
                      shadowOpacity: 0.07,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <View>
                      <View className="flex-row items-center mb-2">
                        {/* Campaign Image or Icon */}
                        <View className="w-12 h-12 bg-white rounded-xl items-center justify-center overflow-hidden p-[2px]">
                          {campaign.photoUrl ? (
                            <Image
                              source={{ uri: campaign.photoUrl }}
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: 8,
                              }}
                              contentFit="cover"
                            />
                          ) : (
                            <Text className="font-gBold text-lg text-gray-900">
                              {campaign.title.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>

                        <View className="ml-3 flex-1">
                          <Text
                            className="font-gBold text-[16px] text-gray-900"
                            numberOfLines={2}
                          >
                            {campaign.title}
                          </Text>
                          <View className="flex-row items-center mt-1">
                            <Text
                              className="text-gray-600 text-sm"
                              numberOfLines={1}
                            >
                              {campaign.type}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View className="flex-row items-center mb-2.5">
                        <View className="flex-row items-center bg-blue-100 rounded-full py-2 px-3 mr-2">
                          <CalenderSvg />
                          <Text className="ml-1.5 font-gMedium text-blue-600 text-[14px]">
                            {campaign.date
                              .toDate()
                              .toLocaleDateString("en-US", {
                                day: "numeric",
                                month: "short",
                              })}
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

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View className="flex-row">
                          {(() => {
                            const totalApplicants =
                              (campaign.applied?.length || 0) +
                              (campaign.approved?.length || 0) +
                              (campaign.rejected?.length || 0);

                            if (totalApplicants === 0) {
                              return (
                                <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center border-2 border-white">
                                  <Ionicons
                                    name="people"
                                    size={16}
                                    color="#3B82F6"
                                  />
                                </View>
                              );
                            }

                            const displayCount = Math.min(3, totalApplicants);
                            const avatarElements = [];

                            for (let i = 0; i < displayCount; i++) {
                              const user = avatars[i];
                              avatarElements.push(
                                <View
                                  key={user ? user.name : `placeholder-${i}`}
                                  className={`w-8 h-8 rounded-full border-2 border-white overflow-hidden ${
                                    i === 0 ? "" : "-ml-2"
                                  }`}
                                >
                                  {user && user.photoUrl ? (
                                    <Image
                                      source={{ uri: user.photoUrl }}
                                      style={{ width: "100%", height: "100%" }}
                                      contentFit="cover"
                                    />
                                  ) : (
                                    <View className="w-full h-full bg-gray-200 items-center justify-center">
                                      {user ? (
                                        <Text className="text-gray-600 font-gBold text-xs">
                                          {user.name.charAt(0).toUpperCase()}
                                        </Text>
                                      ) : (
                                        <Ionicons
                                          name="person"
                                          size={12}
                                          color="#6B7280"
                                        />
                                      )}
                                    </View>
                                  )}
                                </View>
                              );
                            }

                            return avatarElements;
                          })()}
                        </View>
                        <View className="flex-col">
                          <Text className="ml-2 text-gray-600 font-gMedium text-sm">
                            {(() => {
                              const totalApplicants =
                                (campaign.applied?.length || 0) +
                                (campaign.approved?.length || 0) +
                                (campaign.rejected?.length || 0);

                              if (totalApplicants === 0) {
                                return "No applicants yet";
                              } else if (totalApplicants <= 4) {
                                return totalApplicants === 1
                                  ? "1 applicant"
                                  : `${totalApplicants} applicants`;
                              } else {
                                const remainingCount = totalApplicants - 4;
                                return `+ ${remainingCount} more joined`;
                              }
                            })()}
                          </Text>
                          {campaign.applicantCap && (
                            <View className="flex-row items-center ml-2 mt-1">
                              <View
                                className={`px-2 py-1 rounded-full ${
                                  (campaign.applied?.length || 0) >=
                                  campaign.applicantCap
                                    ? "bg-red-100"
                                    : "bg-blue-100"
                                }`}
                              >
                                <Text
                                  className={`text-xs font-gBold ${
                                    (campaign.applied?.length || 0) >=
                                    campaign.applicantCap
                                      ? "text-red-700"
                                      : "text-blue-700"
                                  }`}
                                >
                                  {campaign.applied?.length || 0}/
                                  {campaign.applicantCap} spots
                                  {(campaign.applied?.length || 0) >=
                                    campaign.applicantCap && " - Full"}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Status or Apply Button */}
                      {(() => {
                        const isCompleted = campaign.status === "completed";
                        const isInProgress = campaign.status === "inprogress";
                        const isFull =
                          campaign.applicantCap &&
                          (campaign.applied?.length || 0) >=
                            campaign.applicantCap;
                        const cannotApply =
                          isCompleted || isInProgress || isFull;

                        if (userStatus === "approved") {
                          return (
                            <TouchableOpacity
                              onPress={() =>
                                router.push(
                                  `/(user-tabs)/campaign/campaign-chat?campaignId=${campaign.id}` as any
                                )
                              }
                              className="bg-green-100/80 border border-green-300 rounded-xl px-4 py-2 flex-row items-center"
                            >
                              <Ionicons
                                name="chatbubbles"
                                size={16}
                                color="#15803d"
                              />
                              <Text className="text-green-700 font-gBold text-sm ml-2">
                                Message
                              </Text>
                            </TouchableOpacity>
                          );
                        } else if (userStatus === "pending") {
                          return (
                            <View className="flex-row items-center gap-x-1">
                              <View className="bg-yellow-100 rounded-xl px-2.5 py-1.5">
                                <Text className="text-yellow-700 font-gBold text-xs">
                                  Pending
                                </Text>
                              </View>
                              {!cannotApply && (
                                <TouchableOpacity
                                  onPress={() =>
                                    handleUnapplyCampaign(
                                      campaign.id,
                                      campaign.title
                                    )
                                  }
                                  className="bg-red-100 border border-red-200 rounded-xl px-2.5 py-1.5"
                                >
                                  <Text className="text-red-700 font-gBold text-xs">
                                    Withdraw
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        } else if (userStatus === "rejected") {
                          return (
                            <View className="flex-row items-center gap-x-1">
                              <View className="bg-red-100 rounded-xl px-2.5 py-1.5">
                                <Text className="text-red-700 font-gBold text-xs">
                                  Rejected
                                </Text>
                              </View>
                              {!cannotApply ? (
                                <TouchableOpacity
                                  onPress={() =>
                                    handleApplyCampaign(campaign.id)
                                  }
                                  className="bg-blue-100 border border-blue-200 rounded-xl px-2.5 py-1.5"
                                >
                                  <Text className="text-blue-700 font-gBold text-xs">
                                    Reapply
                                  </Text>
                                </TouchableOpacity>
                              ) : isFull && !isCompleted && !isInProgress ? (
                                <View className="bg-gray-100 rounded-xl px-2.5 py-1.5">
                                  <Text className="text-gray-500 font-gBold text-xs">
                                    Full
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        } else if (cannotApply) {
                          // Show "Full" indicator for full campaigns that aren't completed or in progress
                          if (isFull && !isCompleted && !isInProgress) {
                            return (
                              <View className="bg-gray-200 rounded-xl px-4 py-2">
                                <Text className="text-gray-600 font-gBold text-sm">
                                  Campaign Full
                                </Text>
                              </View>
                            );
                          }
                          // Don't show any button for completed or in progress campaigns
                          return null;
                        } else {
                          return (
                            <TouchableOpacity
                              className="bg-white/20 backdrop-blur rounded-xl px-4 py-2"
                              onPress={() => handleApplyCampaign(campaign.id)}
                            >
                              <Text className="text-gray-800 font-gBold text-sm">
                                Apply Now
                              </Text>
                            </TouchableOpacity>
                          );
                        }
                      })()}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          );
        })()}
      </View>

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
              <Text className="text-2xl font-bold text-gray-900">My Chats</Text>
              <TouchableOpacity
                onPress={() => setSubChatsModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View className="flex-1 px-6 py-4">
              {loadingChats ? (
                <View className="flex-1 justify-center items-center">
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text className="text-gray-500 mt-4">Loading chats...</Text>
                </View>
              ) : allChats.length === 0 ? (
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
                    You'll see group chats and approved campaigns here
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
                            `/(user-tabs)/campaign/sub-chat?id=${item.id}` as any
                          );
                        } else {
                          router.push(
                            `/(user-tabs)/campaign/campaign-chat?campaignId=${item.id}` as any
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

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl">
            <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
              <Text className="text-2xl font-bold text-gray-900">
                Filter Campaigns
              </Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View className="p-6">
              <TouchableOpacity
                onPress={() => {
                  setActiveTab("upcoming");
                  setFilterModalVisible(false);
                }}
                className={`flex-row items-center justify-between p-4 rounded-xl mb-3 ${
                  activeTab === "upcoming" ? "bg-blue-50" : "bg-gray-50"
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-3 h-3 rounded-full mr-3 ${
                      activeTab === "upcoming" ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <Text
                    className={`font-medium ${
                      activeTab === "upcoming"
                        ? "text-blue-600"
                        : "text-gray-700"
                    }`}
                  >
                    Active Campaigns
                  </Text>
                </View>
                {activeTab === "upcoming" && (
                  <Ionicons name="checkmark" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setActiveTab("inprogress");
                  setFilterModalVisible(false);
                }}
                className={`flex-row items-center justify-between p-4 rounded-xl mb-3 ${
                  activeTab === "inprogress" ? "bg-blue-50" : "bg-gray-50"
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-3 h-3 rounded-full mr-3 ${
                      activeTab === "inprogress"
                        ? "bg-orange-500"
                        : "bg-gray-400"
                    }`}
                  />
                  <Text
                    className={`font-medium ${
                      activeTab === "inprogress"
                        ? "text-blue-600"
                        : "text-gray-700"
                    }`}
                  >
                    In Progress
                  </Text>
                </View>
                {activeTab === "inprogress" && (
                  <Ionicons name="checkmark" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setActiveTab("completed");
                  setFilterModalVisible(false);
                }}
                className={`flex-row items-center justify-between p-4 rounded-xl mb-6 ${
                  activeTab === "completed" ? "bg-blue-50" : "bg-gray-50"
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-3 h-3 rounded-full mr-3 ${
                      activeTab === "completed" ? "bg-blue-500" : "bg-gray-400"
                    }`}
                  />
                  <Text
                    className={`font-medium ${
                      activeTab === "completed"
                        ? "text-blue-600"
                        : "text-gray-700"
                    }`}
                  >
                    Completed
                  </Text>
                </View>
                {activeTab === "completed" && (
                  <Ionicons name="checkmark" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default campaign;
