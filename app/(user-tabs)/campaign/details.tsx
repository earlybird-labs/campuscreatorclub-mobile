import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import DollarSvg from "@/assets/svgs/DollarIcon";
import CalenderSvg from "@/assets/svgs/CalenderIcon";
import {
  trackCampaignViewed,
  trackCampaignApplied,
  trackCampaignContentUploaded,
} from "@/utils/appsFlyerEvents";

const Details = () => {
  const { id } = useLocalSearchParams();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState<
    "approved" | "pending" | "rejected" | null
  >(null);
  const [avatars, setAvatars] = useState<{ name: string; photoUrl?: string }[]>(
    []
  );

  const db = getFirestore();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!id) return;
    const fetchCampaign = async () => {
      setLoading(true);
      try {
        const campaignRef = doc(db, "campaigns", id as string);
        const campaignSnap = await getDoc(campaignRef);
        if (!campaignSnap.exists()) {
          Alert.alert("Not found", "Campaign not found");
          router.back();
          return;
        }
        const data = campaignSnap.data();
        setCampaign({ id: campaignSnap.id, ...data });

        // Track campaign viewed
        trackCampaignViewed(currentUser?.uid || null, id as string, data?.title);

        // Determine user status
        let status: "approved" | "pending" | "rejected" | null = null;
        if (data && data.approved?.includes(currentUser?.uid))
          status = "approved";
        else if (data && data.rejected?.includes(currentUser?.uid))
          status = "rejected";
        else if (data && data.applied?.includes(currentUser?.uid))
          status = "pending";
        setUserStatus(status);

        // Fetch up to 4 avatars
        const allUserIds = [
          ...(data?.approved || []),
          ...(data?.applied || []),
          ...(data?.rejected || []),
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
        setAvatars(avatarList);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaign();
  }, [id]);

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

  const handleApply = async () => {
    if (!currentUser || !id) return;

    try {
      const campaignRef = doc(db, "campaigns", id as string);

      // Get current campaign data to check applicant cap
      const campaignDoc = await getDoc(campaignRef);
      const campaignData = campaignDoc.data();

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

      await updateDoc(campaignRef, {
        applied: arrayUnion(currentUser.uid),
      });

      // Track campaign application for AppsFlyer
      trackCampaignApplied(
        currentUser?.uid || null,
        id as string,
        campaign?.title,
        campaign?.type
      );

      setUserStatus("pending");

      // Redirect to campaign link if it exists
      if (campaign?.link) {
        const url = campaign.link.startsWith("http")
          ? campaign.link
          : `https://${campaign.link}`;
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

  const handleUploadContent = async () => {
    if (!campaign?.submissionLink) {
      Alert.alert(
        "No Submission Link",
        "The admin hasn't provided a submission link for this campaign yet. Please contact them or check back later."
      );
      return;
    }

    try {
      // Track content upload for AppsFlyer
      trackCampaignContentUploaded(
        currentUser?.uid || null,
        campaign.id,
        campaign.title
      );

      const supported = await Linking.canOpenURL(campaign.submissionLink);
      if (supported) {
        await Linking.openURL(campaign.submissionLink);
      } else {
        Alert.alert(
          "Invalid Link",
          "Cannot open the submission link. Please contact the admin."
        );
      }
    } catch (error) {
      console.error("Error opening submission link:", error);
      Alert.alert("Error", "Failed to open submission link. Please try again.");
    }
  };

  if (loading || !campaign) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  // Count for avatars
  const totalApplicants =
    (campaign.approved?.length || 0) +
    (campaign.applied?.length || 0) +
    (campaign.rejected?.length || 0);
  const remainingCount = totalApplicants - avatars.length;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header with back, avatars, chat icon */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2 bg-white">
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-14 h-14 rounded-full bg-white items-center justify-center shadow-sm border border-gray-100"
          style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8 }}
        >
          <Ionicons name="arrow-back" size={28} color="#222" />
        </TouchableOpacity>
        {/* Avatars group */}
        {avatars.length > 0 && (
          <View
            className="flex-row items-center px-2 py-1 bg-white rounded-full border border-gray-200 shadow-sm"
            style={{ elevation: 2 }}
          >
            {avatars.map((user, idx) => (
              <View
                key={idx}
                className={`w-8 h-8 rounded-full border-2 border-white overflow-hidden ${
                  idx === 0 ? "" : "-ml-3"
                }`}
                style={{ backgroundColor: "#F3F4F6" }}
              >
                {user.photoUrl ? (
                  <Image
                    source={{ uri: user.photoUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                    <Text className="text-gray-700 font-gBold text-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            ))}
            {remainingCount > 0 && (
              <View className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 items-center justify-center -ml-3">
                <Text className="text-indigo-500 font-gBold text-base">
                  +{remainingCount}
                </Text>
              </View>
            )}
          </View>
        )}
        {/* Chat icon */}
        <TouchableOpacity
          onPress={() =>
            router.push(`/campaign/campaign-chat?campaignId=${id}` as any)
          }
          className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center"
        >
          <Ionicons name="chatbubbles" size={20} color="#3B82F6" />
        </TouchableOpacity>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Campaign Image */}
        <View className="w-full aspect-[1.6]  mt-4 mb-2 p-3 items-center justify-center">
          {campaign.photoUrl ? (
            <Image
              source={{ uri: campaign.photoUrl }}
              style={{ width: '100%', height: '100%', borderRadius: 12 }}
              contentFit="cover"
            />
          ) : null}
        </View>

        {/* Campaign Info */}
        <View className="px-4 mt-2">
          <Text className="font-gBold text-[22px] text-gray-900 mb-2">
            {campaign.title}
          </Text>
          <View className="flex-row items-center mb-2">
            <View className="flex-row items-center bg-blue-100 rounded-full py-2 px-3 mr-2">
              <CalenderSvg />
              <Text className="ml-1.5 font-gMedium text-blue-600 text-[14px]">
                {campaign.date.toDate().toLocaleDateString("en-US", {
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
                  : `$${formatNumber(campaign.reward || "0")} / ${formatNumber(
                      campaign.requiredViews || "0"
                    )}`}
              </Text>
            </View>
          </View>
          <Text className="text-gray-700 text-base mb-4">
            {campaign.content}
          </Text>

          {/* Applicant Cap Indicator */}
          {campaign.applicantCap && (
            <View className="mb-4">
              <View
                className={`px-3 py-2 rounded-lg ${
                  (campaign.applied?.length || 0) >= campaign.applicantCap
                    ? "bg-red-50 border border-red-200"
                    : "bg-blue-50 border border-blue-200"
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`font-gMedium text-sm ${
                      (campaign.applied?.length || 0) >= campaign.applicantCap
                        ? "text-red-700"
                        : "text-blue-700"
                    }`}
                  >
                    Applications: {campaign.applied?.length || 0} /{" "}
                    {campaign.applicantCap}
                  </Text>
                  {(campaign.applied?.length || 0) >= campaign.applicantCap && (
                    <View className="bg-red-100 px-2 py-1 rounded-full">
                      <Text className="text-red-700 font-gBold text-xs">
                        FULL
                      </Text>
                    </View>
                  )}
                </View>
                <View className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <View
                    className={`h-2 rounded-full ${
                      (campaign.applied?.length || 0) >= campaign.applicantCap
                        ? "bg-red-500"
                        : "bg-blue-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        ((campaign.applied?.length || 0) /
                          campaign.applicantCap) *
                          100
                      )}%`,
                    }}
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* View Campaign Brief Button - Always Visible */}
        {campaign.link && (
          <View className="px-4 mt-4">
            <TouchableOpacity
              onPress={() => {
                if (campaign.link) {
                  Linking.openURL(campaign.link).catch((err) =>
                    Alert.alert("Error", "Could not open campaign brief link")
                  );
                }
              }}
              className="bg-blue-500 rounded-xl py-3 items-center flex-row justify-center"
            >
              <Ionicons name="link-outline" size={20} color="white" />
              <Text className="text-white font-gBold text-base ml-2">
                View Campaign Brief
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status or Action Button */}
        <View className="px-4 mt-2">
          {userStatus === "approved" ? (
            <TouchableOpacity
              className="bg-[#6476E8] rounded-xl py-4 items-center mt-4"
              onPress={handleUploadContent}
            >
              <Text className="text-white font-gBold text-lg">
                Upload Content
              </Text>
            </TouchableOpacity>
          ) : userStatus === "pending" ? (
            <View className="bg-yellow-100 rounded-xl py-4 items-center mt-4">
              <Text className="text-yellow-700 font-gBold text-lg">
                Pending Approval
              </Text>
            </View>
          ) : userStatus === "rejected" ? (
            <View className="bg-red-100 rounded-xl py-4 items-center mt-4">
              <Text className="text-red-700 font-gBold text-lg">Rejected</Text>
            </View>
          ) : campaign.status === "completed" ? (
            <View className="bg-gray-100 rounded-xl py-4 items-center mt-4">
              <Text className="text-gray-500 font-gBold text-lg">
                Campaign Ended
              </Text>
            </View>
          ) : campaign.status === "inprogress" ? (
            <View className="bg-orange-100 rounded-xl py-4 items-center mt-4">
              <Text className="text-orange-700 font-gBold text-lg">
                Campaign In Progress
              </Text>
            </View>
          ) : campaign.applicantCap &&
            (campaign.applied?.length || 0) >= campaign.applicantCap ? (
            <View className="bg-red-100 rounded-xl py-4 items-center mt-4">
              <Text className="text-red-700 font-gBold text-lg">
                Campaign Full
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleApply}
              className="bg-[#6476E8] rounded-xl py-4 items-center mt-4"
            >
              <Text className="text-white font-gBold text-lg">Apply Now</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Details;
