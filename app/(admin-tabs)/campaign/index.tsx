import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  Platform,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import React, { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import DatePicker from "react-native-date-picker";
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
  getDocs,
  where,
  serverTimestamp,
  writeBatch,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import CalenderSvg from "@/assets/svgs/CalenderIcon";
import DollarSvg from "@/assets/svgs/DollarIcon";
import ColorPicker, {
  HueSlider,
  Panel1,
  Preview,
  Swatches,
} from "reanimated-color-picker";
import { runOnJS } from "react-native-reanimated";
import { Award, IdCard } from "lucide-react-native";

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
  submissionLink?: string;
  photoUrl?: string;
  brandColor?: string;
  createdAt: any;
  applied?: string[];
  approved?: string[];
  rejected?: string[];
  status?: "active" | "inprogress" | "completed";
  completedAt?: any;
  ambassadorId?: string; // ID of assigned ambassador
  isAmbassadorProgram?: boolean; // Flag for ambassador program campaigns
}

interface UserPreview {
  id: string;
  name: string;
  photoUrl?: string;
}

interface SubChat {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  createdAt: any;
}

interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  university?: string;
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

const campaigns = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignUsers, setCampaignUsers] = useState<
    Record<string, UserPreview[]>
  >({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "upcoming" | "inprogress" | "completed"
  >("upcoming");

  // View mode state (Campaigns vs Ambassador Programs)
  const [viewMode, setViewMode] = useState<"campaigns" | "ambassador">(
    "campaigns"
  );

  // Filter and Ambassador modal states
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [ambassadorModalVisible, setAmbassadorModalVisible] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCampaignForAmbassador, setSelectedCampaignForAmbassador] =
    useState<Campaign | null>(null);
  const [assigningAmbassador, setAssigningAmbassador] = useState(false);

  // Sub-chats state
  const [subChatsModalVisible, setSubChatsModalVisible] = useState(false);
  const [createChatModalVisible, setCreateChatModalVisible] = useState(false);
  const [subChats, setSubChats] = useState<SubChat[]>([]);
  const [allChats, setAllChats] = useState<ChatItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [chatName, setChatName] = useState("");
  const [chatDescription, setChatDescription] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const [campaignData, setCampaignData] = useState({
    title: "",
    date: new Date(),
    type: "",
    paymentType: "Gifted", // "Gifted" or "Paid"
    amount: "",
    content: "",
    link: "",
    submissionLink: "",
    brandColor: "#3B82F6",
    status: "active" as "active" | "inprogress" | "completed",
    ambassadorId: null as string | null,
    isAmbassadorProgram: false,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showAmountDropdown, setShowAmountDropdown] = useState(false);

  // Ambassador search for create modal
  const [createAmbassadorSearch, setCreateAmbassadorSearch] = useState("");
  const [createSearchedUsers, setCreateSearchedUsers] = useState<User[]>([]);
  const [selectedAmbassador, setSelectedAmbassador] = useState<User | null>(
    null
  );

  const db = getFirestore();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const campaignTypes = [
    "Social Media Campaign",
    "Email Marketing",
    "Influencer Partnership",
    "Content Marketing",
    "Paid Advertising",
    "Event Promotion",
    "Product Launch",
    "Brand Awareness",
  ];

  const paymentRanges = [
    "$5-$10",
    "$10-$20",
    "$20-$35",
    "$35-$50",
    "$50-$75",
    "$75-$150",
    "$150-$250",
    "$250-$500",
    "$500-$1000",
    "$1000+",
  ];

  // Fetch campaigns from Firebase
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

  // Fetch user previews for campaigns
  useEffect(() => {
    const fetchCampaignUsers = async () => {
      const userPreviews: Record<string, UserPreview[]> = {};

      for (const campaign of campaigns) {
        const allUserIds = [
          ...(campaign.applied || []),
          ...(campaign.approved || []),
          ...(campaign.rejected || []),
        ];

        const uniqueUserIds = [...new Set(allUserIds)];
        const userPreviewsForCampaign: UserPreview[] = [];

        // Fetch first 4 users
        for (let i = 0; i < Math.min(4, uniqueUserIds.length); i++) {
          try {
            const userDoc = await getDoc(doc(db, "users", uniqueUserIds[i]));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData) {
                userPreviewsForCampaign.push({
                  id: uniqueUserIds[i],
                  name: userData.name || "Unknown",
                  photoUrl: userData.photoUrl,
                });
              }
            }
          } catch (error) {
            console.error("Error fetching user preview:", error);
          }
        }

        userPreviews[campaign.id] = userPreviewsForCampaign;
      }

      setCampaignUsers(userPreviews);
    };

    if (campaigns.length > 0) {
      fetchCampaignUsers();
    }
  }, [campaigns]);

  // Fetch ALL sub-chats - admin can see and access all sub-chats
  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, "subChats"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!querySnapshot) {
          console.log("QuerySnapshot is null");
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

  // Fetch all users for group creation
  useEffect(() => {
    const q = query(collection(db, "users"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!querySnapshot) {
          console.log("Users QuerySnapshot is null");
          setUsers([]);
          return;
        }

        const usersData: User[] = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          // Don't include current user in the list
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

        setUsers(usersData);
      },
      (error) => {
        console.error("Error fetching users:", error);
        setUsers([]);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Combine sub-chats and campaigns into unified chat list
  useEffect(() => {
    if (!currentUser) {
      setAllChats([]);
      return;
    }

    const chatItems: ChatItem[] = [];

    // Add ALL sub-chats (admin can access any sub-chat)
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

    // Add all campaigns (admin can see all campaigns they created)
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

    const filename = `campaigns/${Date.now()}.jpg`;
    const reference = storage().ref(filename);

    // putFile expects a local file path (e.g., file:///...)
    await reference.putFile(uri);
    const downloadUrl = await reference.getDownloadURL();
    return downloadUrl;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
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

  const handleCreateCampaign = async () => {
    if (!campaignData.title.trim()) {
      Alert.alert("Error", "Please enter a campaign title");
      return;
    }

    setUploading(true);
    try {
      let photoUrl = "";

      // Upload image if selected
      if (selectedImage) {
        photoUrl = await uploadImage(selectedImage);
      }

      if (editingCampaign) {
        // Update existing campaign
        await updateDoc(doc(db, "campaigns", editingCampaign.id), {
          title: campaignData.title,
          date: campaignData.date,
          type: campaignData.type,
          paymentType: campaignData.paymentType,
          amount: campaignData.amount,
          content: campaignData.content,
          link: campaignData.link,
          submissionLink: campaignData.submissionLink,
          brandColor: campaignData.brandColor,
          status: campaignData.status,
          isAmbassadorProgram: campaignData.isAmbassadorProgram,
          ...(selectedImage && { photoUrl }),
          ...(campaignData.status === "completed" &&
            !editingCampaign.completedAt && { completedAt: new Date() }),
          updatedAt: new Date(),
        });
        Alert.alert("Success", "Campaign updated successfully!");
      } else {
        // Create new campaign
        const campaignDocRef = await addDoc(collection(db, "campaigns"), {
          title: campaignData.title,
          date: campaignData.date,
          type: campaignData.type,
          paymentType: campaignData.paymentType,
          amount: campaignData.amount,
          content: campaignData.content,
          link: campaignData.link,
          submissionLink: campaignData.submissionLink,
          photoUrl: photoUrl,
          brandColor: campaignData.brandColor,
          status: campaignData.status,
          isAmbassadorProgram: campaignData.isAmbassadorProgram,
          createdAt: new Date(),
          ...(campaignData.status === "completed" && {
            completedAt: new Date(),
          }),
          ...(selectedAmbassador && { ambassadorId: selectedAmbassador.id }),
        });

        // If ambassador is selected, assign them to this campaign
        if (selectedAmbassador) {
          try {
            const userRef = doc(db, "users", selectedAmbassador.id);
            await updateDoc(userRef, {
              isAmbassador: true,
              assignedCampaignId: campaignDocRef.id,
              assignedCampaignChatId: campaignDocRef.id,
              ambassadorAssignedAt: new Date(),
            });
          } catch (ambassadorError) {
            console.error("Error assigning ambassador:", ambassadorError);
            // Continue with campaign creation even if ambassador assignment fails
          }
        }

        // Campaign notifications will be sent automatically via Cloud Function
        console.log(
          "Campaign created successfully - notifications will be sent via Cloud Function"
        );

        Alert.alert("Success", "Campaign created successfully!");
      }

      // Reset form
      resetModal();
    } catch (error) {
      console.error("Error creating/updating campaign:", error);
      Alert.alert("Error", "Failed to save campaign. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    const brandColor = campaign.brandColor || "#3B82F6";
    setSelectedColor(brandColor);
    setCampaignData({
      title: campaign.title,
      date: campaign.date.toDate(),
      type: campaign.type,
      paymentType: (campaign as any).paymentType || "Gifted",
      amount: (campaign as any).amount || "",
      content: campaign.content,
      link: campaign.link,
      submissionLink: (campaign as any).submissionLink || "",
      brandColor: brandColor,
      status: campaign.status || "active",
      ambassadorId: (campaign as any).ambassadorId || null,
      isAmbassadorProgram: (campaign as any).isAmbassadorProgram || false,
    });
    if (campaign.photoUrl) {
      setSelectedImage(campaign.photoUrl);
    }
    setModalVisible(true);
  };

  const handleDeleteCampaign = (campaignId: string) => {
    Alert.alert(
      "Delete Campaign",
      "Are you sure you want to delete this campaign? This action cannot be undone.",
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
              await deleteDoc(doc(db, "campaigns", campaignId));
              Alert.alert("Success", "Campaign deleted successfully!");
            } catch (error) {
              console.error("Error deleting campaign:", error);
              Alert.alert(
                "Error",
                "Failed to delete campaign. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const handleMarkAsCompleted = (campaignId: string) => {
    Alert.alert("Mark as Completed", "Mark this campaign as completed?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Complete",
        onPress: async () => {
          try {
            // First, get all chat messages from the campaign's chat subcollection
            const chatCollectionRef = collection(
              db,
              "campaigns",
              campaignId,
              "chat"
            );
            const chatSnapshot = await getDocs(chatCollectionRef);

            // Create a batch to delete all chat messages
            const batch = writeBatch(db);
            chatSnapshot.forEach((chatDoc) => {
              batch.delete(chatDoc.ref);
            });

            // Execute the batch delete for chat messages
            if (!chatSnapshot.empty) {
              await batch.commit();
            }

            // Update the campaign status
            await updateDoc(doc(db, "campaigns", campaignId), {
              status: "completed",
              completedAt: new Date(),
              updatedAt: new Date(),
            });

            Alert.alert(
              "Success",
              "Campaign marked as completed and chat history cleared!"
            );
          } catch (error) {
            console.error("Error updating campaign:", error);
            Alert.alert(
              "Error",
              "Failed to update campaign. Please try again."
            );
          }
        },
      },
    ]);
  };

  const handleMarkAsInProgress = (campaignId: string) => {
    Alert.alert("Mark as In Progress", "Mark this campaign as in progress?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Mark In Progress",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "campaigns", campaignId), {
              status: "inprogress",
              updatedAt: new Date(),
            });
            Alert.alert("Success", "Campaign marked as in progress!");
          } catch (error) {
            console.error("Error updating campaign:", error);
            Alert.alert(
              "Error",
              "Failed to update campaign. Please try again."
            );
          }
        },
      },
    ]);
  };

  // Sub-chat functions
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
      const membersArray = [currentUser!.uid, ...Array.from(selectedUsers)];

      await addDoc(collection(db, "subChats"), {
        name: chatName.trim(),
        description: chatDescription.trim() || "",
        createdBy: currentUser!.uid,
        members: membersArray,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Group chat created successfully!");
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

  const resetModal = () => {
    setModalVisible(false);
    setSelectedImage(null);
    setSelectedColor("#3B82F6");
    setShowColorPicker(false);
    setShowTypeDropdown(false);
    setShowAmountDropdown(false);
    setCampaignData({
      title: "",
      date: new Date(),
      type: "",
      paymentType: "Gifted",
      amount: "",
      content: "",
      link: "",
      submissionLink: "",
      brandColor: "#3B82F6",
      status: "active" as "active" | "inprogress" | "completed",
      ambassadorId: null,
      isAmbassadorProgram: false,
    });

    // Reset ambassador selection
    setSelectedAmbassador(null);
    setCreateAmbassadorSearch("");
    setCreateSearchedUsers([]);
    setEditingCampaign(null);
  };

  // Proper callback for color picker
  const onColorComplete = useCallback((color: { hex: string }) => {
    setSelectedColor(color.hex);
    setCampaignData((prev) => ({ ...prev, brandColor: color.hex }));
  }, []);

  // Worklet function for color picker
  const handleColorChange = useCallback(
    (color: { hex: string }) => {
      "worklet";
      runOnJS(onColorComplete)(color);
    },
    [onColorComplete]
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Since we're using real-time listeners, we just need to show the refresh state briefly
    // The data will automatically update through the onSnapshot listener
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Search users by email
  const searchUsersByEmail = async (email: string) => {
    if (!email.trim()) {
      setSearchedUsers([]);
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("email", ">=", email.toLowerCase()),
        where("email", "<=", email.toLowerCase() + "\uf8ff")
      );

      const snapshot = await getDocs(q);
      const users: User[] = [];

      snapshot.forEach((doc) => {
        const userData = doc.data();
        users.push({
          id: doc.id,
          name: userData.name,
          email: userData.email,
          photoUrl: userData.photoUrl,
          university: userData.university,
        });
      });

      setSearchedUsers(users);
    } catch (error) {
      console.error("Error searching users:", error);
      Alert.alert("Error", "Failed to search users. Please try again.");
    }
  };

  // Search users for ambassador assignment in create modal
  const searchAmbassadorForCreate = async (email: string) => {
    if (!email.trim()) {
      setCreateSearchedUsers([]);
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("email", ">=", email.toLowerCase()),
        where("email", "<=", email.toLowerCase() + "\uf8ff")
      );

      const snapshot = await getDocs(q);
      const users: User[] = [];

      snapshot.forEach((doc) => {
        const userData = doc.data();
        users.push({
          id: doc.id,
          name: userData.name || "Unknown",
          email: userData.email || "",
          photoUrl: userData.photoUrl,
          university: userData.university,
        });
      });

      setCreateSearchedUsers(users);
    } catch (error) {
      console.error("Error searching users:", error);
      setCreateSearchedUsers([]);
    }
  };

  // Assign ambassador
  const assignAmbassador = async () => {
    if (!selectedUser || !selectedCampaignForAmbassador) {
      Alert.alert("Error", "Please select both a user and a campaign.");
      return;
    }

    setAssigningAmbassador(true);
    try {
      // Update user document to add ambassador flag and campaign assignment
      const userRef = doc(db, "users", selectedUser.id);
      await updateDoc(userRef, {
        isAmbassador: true,
        assignedCampaignId: selectedCampaignForAmbassador.id,
        assignedCampaignChatId: selectedCampaignForAmbassador.id, // Using campaign ID as chat ID
        ambassadorAssignedAt: new Date(),
      });

      Alert.alert(
        "Success",
        `${selectedUser.name} has been assigned as ambassador for "${selectedCampaignForAmbassador.title}"`
      );

      // Reset modal state
      setAmbassadorModalVisible(false);
      setSelectedUser(null);
      setSelectedCampaignForAmbassador(null);
      setUserSearchQuery("");
      setSearchedUsers([]);
    } catch (error) {
      console.error("Error assigning ambassador:", error);
      Alert.alert("Error", "Failed to assign ambassador. Please try again.");
    } finally {
      setAssigningAmbassador(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-1 pt-2">
        <View className="flex-row items-center justify-between px-5 mb-5">
          <Text className="font-gBold text-[24px]">
            {/* {viewMode === "campaigns" ? "Campaigns" : "Ambassador Programs"} */}
            Campaigns
          </Text>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              className="w-10 h-10 bg-blue-400 rounded-full items-center justify-center"
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(true)}
              className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
            >
              <Ionicons name="filter" size={18} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAmbassadorModalVisible(true)}
              className="w-10 h-10 bg-green-400 rounded-full items-center justify-center"
            >
              <Award size={18} color="white" />
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

        {/* Campaigns List */}
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
              colors={["#3B82F6"]}
            />
          }
        >
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
                <View className="bg-gray-100 rounded-2xl p-4 mt-4">
                  <Text className="text-gray-500 text-center">
                    {viewMode === "ambassador"
                      ? activeTab === "upcoming"
                        ? "No active ambassador programs yet. Create your first ambassador program!"
                        : activeTab === "inprogress"
                        ? "No ambassador programs in progress."
                        : "No completed ambassador programs yet."
                      : activeTab === "upcoming"
                      ? "No active campaigns yet. Create your first campaign!"
                      : activeTab === "inprogress"
                      ? "No campaigns in progress. Use the play button to move campaigns here."
                      : "No completed campaigns yet. Use the checkmark button to move campaigns here."}
                  </Text>
                </View>
              );
            }

            return (
              <FlatList
                data={filteredCampaigns}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{
                  paddingBottom: 20,
                }}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    className="rounded-[24px] p-4 shadow-sm mb-4"
                    style={{
                      backgroundColor: `${item.brandColor}`, // Adding 20 for 12% opacity
                    }}
                    onPress={() =>
                      router.push(`/campaign/details?id=${item.id}` as any)
                    }
                  >
                    {/* Main Content Row - Clickable */}
                    <View className="flex-row items-start mb-4">
                      {/* App Icon / Campaign Image */}
                      <View className="w-16 h-16 bg-white rounded-2xl items-center justify-center mr-4 overflow-hidden p-[2px]">
                        {item.photoUrl ? (
                          <Image
                            source={{ uri: item.photoUrl }}
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: 16,
                            }}
                            contentFit="cover"
                          />
                        ) : (
                          <Text className="font-gBold text-2xl text-gray-900">
                            {item.title.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>

                      {/* Content */}
                      <View className="flex-1">
                        <Text
                          className="font-gBold text-[16px] text-gray-900 mb-1"
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>
                        <View className="flex-row items-center mb-1">
                          <Text
                            className="text-gray-600 text-sm"
                            numberOfLines={1}
                          >
                            {item.type}
                          </Text>
                        </View>

                        {/* Date and Reward Badges */}
                        <View className="flex-row items-center gap-3 mb-3">
                          <View className="flex-row items-center bg-blue-100 rounded-full py-2 px-3 mr-2">
                            <CalenderSvg />
                            <Text className="ml-1.5 font-gMedium text-blue-600 text-[14px]">
                              {item.date.toDate().toLocaleDateString("en-US", {
                                day: "numeric",
                                month: "short",
                              })}
                            </Text>
                          </View>

                          <View className="flex-row items-center bg-white/50 rounded-full py-2 px-3">
                            {item.paymentType === "Gifted" ? (
                              <Ionicons name="gift" size={16} color="#059669" />
                            ) : (
                              <DollarSvg />
                            )}
                            <Text
                              className={`ml-1.5 font-gMedium text-[14px] ${
                                item.paymentType === "Gifted"
                                  ? "text-emerald-600"
                                  : "text-orange-700"
                              }`}
                            >
                              {item.paymentType === "Paid"
                                ? item.amount || "$0"
                                : item.paymentType === "Gifted"
                                ? "Gifted"
                                : `$${formatNumber(
                                    item.reward || "0"
                                  )} / ${formatNumber(
                                    item.requiredViews || "0"
                                  )}`}
                            </Text>
                          </View>
                        </View>

                        {/* Participant Avatars */}
                        <View className="flex-row items-center">
                          <View className="flex-row">
                            {(() => {
                              const totalApplicants =
                                (item.applied?.length || 0) +
                                (item.approved?.length || 0) +
                                (item.rejected?.length || 0);

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

                              const users = campaignUsers[item.id] || [];
                              const displayCount = Math.min(4, totalApplicants);
                              const avatars = [];

                              for (let i = 0; i < displayCount; i++) {
                                const user = users[i];
                                avatars.push(
                                  <View
                                    key={user ? user.id : `placeholder-${i}`}
                                    className={`w-8 h-8 rounded-full border-2 border-white overflow-hidden ${
                                      i === 0 ? "" : "-ml-2"
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

                              return avatars;
                            })()}
                          </View>
                          <Text className="ml-2 text-gray-600 font-gMedium text-sm">
                            {(() => {
                              const totalApplicants =
                                (item.applied?.length || 0) +
                                (item.approved?.length || 0) +
                                (item.rejected?.length || 0);

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
                        </View>
                      </View>
                    </View>

                    {/* Message/Edit/Delete/Complete Buttons at Bottom Right */}
                    <View className="flex-row justify-end">
                      <View className="flex-row items-center gap-x-2">
                        <TouchableOpacity
                          onPress={() =>
                            router.push(
                              `/(admin-tabs)/campaign/campaign-chat?campaignId=${item.id}` as any
                            )
                          }
                          className="p-2 bg-black/15 backdrop-blur-sm rounded-full shadow-sm border border-white/30"
                        >
                          <Ionicons
                            name="chatbubbles"
                            size={16}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
                        {(!item.status || item.status === "active") && (
                          <TouchableOpacity
                            onPress={() => handleMarkAsInProgress(item.id)}
                            className="p-2 bg-black/15 backdrop-blur-sm rounded-full shadow-sm border border-white/30"
                          >
                            <Ionicons
                              name="play-circle"
                              size={16}
                              color="#FFFFFF"
                            />
                          </TouchableOpacity>
                        )}
                        {(!item.status ||
                          item.status === "active" ||
                          item.status === "inprogress") && (
                          <TouchableOpacity
                            onPress={() => handleMarkAsCompleted(item.id)}
                            className="p-2 bg-black/15 backdrop-blur-sm rounded-full shadow-sm border border-white/30"
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color="#FFFFFF"
                            />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleEditCampaign(item)}
                          className="p-2 bg-black/15 backdrop-blur-sm rounded-full shadow-sm border border-white/30"
                        >
                          <Ionicons name="create" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteCampaign(item.id)}
                          className="p-2 bg-black/15 backdrop-blur-sm rounded-full shadow-sm border border-white/30"
                        >
                          <Ionicons name="trash" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            );
          })()}
        </ScrollView>
      </View>

      {/* Floating Chat Button */}
      <TouchableOpacity
        onPress={() => setSubChatsModalVisible(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg"
        style={{
          shadowColor: "#3B82F6",
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Ionicons name="chatbubbles" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-5/6">
              {/* Header */}
              <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                <Text className="text-2xl font-bold text-gray-900">
                  {editingCampaign ? "Edit Campaign" : "Create Campaign"}
                </Text>
                <TouchableOpacity
                  onPress={resetModal}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                className="flex-1 px-6"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Upload Photo Section */}
                <TouchableOpacity
                  className="bg-gray-50 rounded-2xl p-8 items-center justify-center my-6 min-h-[120px] border-2 border-dashed border-gray-200"
                  onPress={pickImage}
                >
                  {selectedImage ? (
                    <Image
                      source={{ uri: selectedImage }}
                      style={{ width: "100%", height: 128, borderRadius: 12 }}
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
                      <Text className="text-lg font-medium text-gray-600 text-center">
                        {editingCampaign
                          ? "Change photo"
                          : "Upload a\nCampaign photo"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Campaign Title */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-base mb-2">
                    Campaign title
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="Enter campaign title"
                    value={campaignData.title}
                    onChangeText={(text) =>
                      setCampaignData({ ...campaignData, title: text })
                    }
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Campaign Date */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-base mb-2">
                    Campaign Date
                  </Text>
                  <TouchableOpacity
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex-row items-center justify-between"
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text className="text-base text-gray-900">
                      {formatDate(campaignData.date)}
                    </Text>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>

                {/* Date Picker */}
                <DatePicker
                  modal
                  mode="date"
                  open={showDatePicker}
                  date={campaignData.date}
                  onConfirm={(date) => {
                    setShowDatePicker(false);
                    setCampaignData({ ...campaignData, date: date });
                  }}
                  onCancel={() => {
                    setShowDatePicker(false);
                  }}
                />

                {/* Campaign Type */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-base mb-2">
                    Campaign type
                  </Text>
                  <TouchableOpacity
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex-row items-center justify-between"
                    onPress={() => setShowTypeDropdown(!showTypeDropdown)}
                  >
                    <Text
                      className={`text-base ${
                        campaignData.type ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {campaignData.type || "Select campaign type"}
                    </Text>
                    <Ionicons
                      name={showTypeDropdown ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>

                  {showTypeDropdown && (
                    <View className="bg-white border border-gray-200 rounded-xl mt-2 shadow-sm">
                      {campaignTypes.map((type, index) => (
                        <TouchableOpacity
                          key={index}
                          className="px-4 py-3 border-b border-gray-100 last:border-b-0"
                          onPress={() => {
                            setCampaignData({ ...campaignData, type: type });
                            setShowTypeDropdown(false);
                          }}
                        >
                          <Text className="text-base text-gray-900">
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Payment Type Section */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-base mb-2">
                    Payment Type
                  </Text>
                  <View className="flex-row bg-gray-50 rounded-xl p-1 border border-gray-200">
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor:
                          campaignData.paymentType === "Gifted"
                            ? "#ffffff"
                            : "transparent",
                        shadowOpacity:
                          campaignData.paymentType === "Gifted" ? 0.1 : 0,
                        shadowRadius:
                          campaignData.paymentType === "Gifted" ? 4 : 0,
                        elevation:
                          campaignData.paymentType === "Gifted" ? 2 : 0,
                      }}
                      onPress={() =>
                        setCampaignData({
                          ...campaignData,
                          paymentType: "Gifted",
                          amount: "",
                        })
                      }
                    >
                      <Text
                        style={{
                          fontWeight: "500",
                          color:
                            campaignData.paymentType === "Gifted"
                              ? "#2563EB"
                              : "#6B7280",
                        }}
                      >
                        Gifted
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor:
                          campaignData.paymentType === "Paid"
                            ? "#ffffff"
                            : "transparent",
                        shadowOpacity:
                          campaignData.paymentType === "Paid" ? 0.1 : 0,
                        shadowRadius:
                          campaignData.paymentType === "Paid" ? 4 : 0,
                        elevation: campaignData.paymentType === "Paid" ? 2 : 0,
                      }}
                      onPress={() =>
                        setCampaignData({
                          ...campaignData,
                          paymentType: "Paid",
                        })
                      }
                    >
                      <Text
                        style={{
                          fontWeight: "500",
                          color:
                            campaignData.paymentType === "Paid"
                              ? "#2563EB"
                              : "#6B7280",
                        }}
                      >
                        Paid
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Amount Field - Only show for Paid campaigns */}
                {campaignData.paymentType === "Paid" && (
                  <View className="mb-6">
                    <Text className="text-gray-600 text-base mb-2">
                      Payment Range
                    </Text>
                    <TouchableOpacity
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex-row items-center justify-between"
                      onPress={() => setShowAmountDropdown(!showAmountDropdown)}
                    >
                      <Text
                        className={`text-base ${
                          campaignData.amount
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      >
                        {campaignData.amount || "Select payment range"}
                      </Text>
                      <Ionicons
                        name={
                          showAmountDropdown ? "chevron-up" : "chevron-down"
                        }
                        size={20}
                        color="#6B7280"
                      />
                    </TouchableOpacity>

                    {showAmountDropdown && (
                      <View className="bg-white border border-gray-200 rounded-xl mt-2 shadow-sm">
                        {paymentRanges.map((range, index) => (
                          <TouchableOpacity
                            key={index}
                            className="px-4 py-3 border-b border-gray-100 last:border-b-0"
                            onPress={() => {
                              setCampaignData({
                                ...campaignData,
                                amount: range,
                              });
                              setShowAmountDropdown(false);
                            }}
                          >
                            <Text className="text-base text-gray-900">
                              {range}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Campaign Status */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-base mb-2">
                    Campaign Status
                  </Text>
                  <View className="flex-row bg-gray-50 rounded-xl p-1 border border-gray-200">
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor:
                          campaignData.status === "active"
                            ? "#ffffff"
                            : "transparent",
                        shadowOpacity:
                          campaignData.status === "active" ? 0.1 : 0,
                        shadowRadius: campaignData.status === "active" ? 4 : 0,
                        elevation: campaignData.status === "active" ? 2 : 0,
                      }}
                      onPress={() =>
                        setCampaignData({
                          ...campaignData,
                          status: "active",
                        })
                      }
                    >
                      <Text
                        style={{
                          fontWeight: "500",
                          color:
                            campaignData.status === "active"
                              ? "#2563EB"
                              : "#6B7280",
                        }}
                      >
                        Active
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor:
                          campaignData.status === "inprogress"
                            ? "#ffffff"
                            : "transparent",
                        shadowOpacity:
                          campaignData.status === "inprogress" ? 0.1 : 0,
                        shadowRadius:
                          campaignData.status === "inprogress" ? 4 : 0,
                        elevation: campaignData.status === "inprogress" ? 2 : 0,
                      }}
                      onPress={() =>
                        setCampaignData({
                          ...campaignData,
                          status: "inprogress",
                        })
                      }
                    >
                      <Text
                        style={{
                          fontWeight: "500",
                          color:
                            campaignData.status === "inprogress"
                              ? "#2563EB"
                              : "#6B7280",
                        }}
                      >
                        In Progress
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor:
                          campaignData.status === "completed"
                            ? "#ffffff"
                            : "transparent",
                        shadowOpacity:
                          campaignData.status === "completed" ? 0.1 : 0,
                        shadowRadius:
                          campaignData.status === "completed" ? 4 : 0,
                        elevation: campaignData.status === "completed" ? 2 : 0,
                      }}
                      onPress={() =>
                        setCampaignData({
                          ...campaignData,
                          status: "completed",
                        })
                      }
                    >
                      <Text
                        style={{
                          fontWeight: "500",
                          color:
                            campaignData.status === "completed"
                              ? "#2563EB"
                              : "#6B7280",
                        }}
                      >
                        Completed
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {campaignData.status === "completed" && (
                    <Text className="text-sm text-gray-500 mt-2">
                      Use this to upload past campaigns that have already been
                      completed.
                    </Text>
                  )}
                  {campaignData.status === "inprogress" && (
                    <Text className="text-sm text-gray-500 mt-2">
                      Mark campaigns as in progress when they are actively
                      running.
                    </Text>
                  )}
                </View>

                {/* Ambassador Program Toggle */}
                <View className="mb-6">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text className="text-gray-600 text-base mb-1">
                        Ambassador Program
                      </Text>
                      <Text className="text-gray-400 text-sm">
                        Enable this for campaigns that are part of the
                        ambassador program
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        setCampaignData({
                          ...campaignData,
                          isAmbassadorProgram:
                            !campaignData.isAmbassadorProgram,
                        })
                      }
                      className={`w-14 h-8 rounded-full p-1 ${
                        campaignData.isAmbassadorProgram
                          ? "bg-blue-500"
                          : "bg-gray-300"
                      }`}
                    >
                      <View
                        className={`w-6 h-6 rounded-full bg-white shadow-sm ${
                          campaignData.isAmbassadorProgram ? "ml-auto" : ""
                        }`}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Campaign Content */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-base mb-2">
                    Campaign content
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="Describe your campaign content..."
                    value={campaignData.content}
                    onChangeText={(text) =>
                      setCampaignData({ ...campaignData, content: text })
                    }
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Campaign Link */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-base mb-2">
                    Campaign Link
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="https://example.com"
                    value={campaignData.link}
                    onChangeText={(text) =>
                      setCampaignData({ ...campaignData, link: text })
                    }
                    keyboardType="url"
                    autoCapitalize="none"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Submission Link */}
                <View className="mb-8">
                  <Text className="text-gray-600 text-base mb-2">
                    Content Submission Link
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900"
                    placeholder="https://forms.google.com/... or https://airtable.com/..."
                    value={campaignData.submissionLink}
                    onChangeText={(text) =>
                      setCampaignData({ ...campaignData, submissionLink: text })
                    }
                    keyboardType="url"
                    autoCapitalize="none"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text className="text-gray-500 text-sm mt-2">
                    Where users will submit their content (Google Forms,
                    Airtable, etc.)
                  </Text>
                </View>

                {/* Brand Color */}
                <View className="mb-8">
                  <Text className="text-gray-600 text-base mb-2">
                    Brand Color
                  </Text>
                  {/* Color code input */}
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-3"
                    placeholder="#3B82F6"
                    value={selectedColor}
                    onChangeText={(text) => {
                      // Only allow valid hex codes
                      let hex = text.startsWith("#") ? text : `#${text}`;
                      if (/^#([0-9A-Fa-f]{0,6})$/.test(hex)) {
                        setSelectedColor(hex);
                        setCampaignData((prev) => ({
                          ...prev,
                          brandColor: hex,
                        }));
                      }
                    }}
                    maxLength={7}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex-row items-center justify-between"
                    onPress={() => setShowColorPicker(true)}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="w-6 h-6 rounded-full mr-3 border border-gray-300"
                        style={{ backgroundColor: selectedColor }}
                      />
                      <Text className="text-base text-gray-900">
                        {selectedColor.toUpperCase()}
                      </Text>
                    </View>
                    <Ionicons
                      name="color-palette-outline"
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>

                {/* Color Picker Modal */}
                <Modal
                  visible={showColorPicker}
                  animationType="slide"
                  transparent={true}
                  onRequestClose={() => setShowColorPicker(false)}
                >
                  <View className="flex-1 bg-black/50 justify-center items-center px-4">
                    <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
                      <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-xl font-bold text-gray-900">
                          Choose Brand Color
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowColorPicker(false)}
                          className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                        >
                          <Ionicons name="close" size={20} color="#6B7280" />
                        </TouchableOpacity>
                      </View>

                      <ColorPicker
                        style={{ width: "100%" }}
                        value={selectedColor}
                        onComplete={handleColorChange}
                      >
                        {/* Main color panel */}
                        <Panel1
                          style={{
                            width: "100%",
                            height: 200,
                            marginBottom: 16,
                            borderRadius: 12,
                          }}
                        />

                        {/* Hue slider */}
                        <HueSlider
                          style={{
                            width: "100%",
                            height: 40,
                            marginBottom: 16,
                            borderRadius: 8,
                          }}
                        />

                        {/* Color swatches for quick selection */}
                        <Swatches
                          style={{ marginBottom: 16 }}
                          swatchStyle={{
                            borderRadius: 8,
                            height: 30,
                            width: 30,
                            margin: 4,
                            borderWidth: 1,
                            borderColor: "#e5e7eb",
                          }}
                          colors={[
                            "#FF6B6B",
                            "#4ECDC4",
                            "#45B7D1",
                            "#96CEB4",
                            "#FFEAA7",
                            "#DDA0DD",
                            "#98D8C8",
                          ]}
                        />

                        {/* Color preview */}
                        <Preview
                          style={{
                            width: "100%",
                            height: 50,
                            borderRadius: 12,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: "#e5e7eb",
                          }}
                        />

                        {/* Display selected color hex */}
                        <View className="mb-4">
                          <Text className="text-gray-600 text-center text-sm">
                            Selected Color: {selectedColor.toUpperCase()}
                          </Text>
                        </View>
                      </ColorPicker>

                      <TouchableOpacity
                        className="bg-blue-500 rounded-xl py-3 items-center mt-4"
                        onPress={() => setShowColorPicker(false)}
                      >
                        <Text className="text-white text-base font-semibold">
                          Done
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Modal>

                {/* Ambassador Assignment Section */}
                <View className="mb-8">
                  <Text className="text-gray-600 text-base mb-2">
                    Assign Ambassador (Optional)
                  </Text>

                  {selectedAmbassador ? (
                    <View className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1">
                          <View className="w-10 h-10 rounded-full bg-blue-200 items-center justify-center mr-3 overflow-hidden">
                            {selectedAmbassador.photoUrl ? (
                              <Image
                                source={{ uri: selectedAmbassador.photoUrl }}
                                style={{ width: "100%", height: "100%" }}
                                contentFit="cover"
                              />
                            ) : (
                              <Text className="text-blue-700 font-gBold text-sm">
                                {selectedAmbassador.name
                                  .charAt(0)
                                  .toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View className="flex-1">
                            <Text className="font-gBold text-blue-900 text-base">
                              {selectedAmbassador.name}
                            </Text>
                            <Text className="text-blue-600 text-sm">
                              {selectedAmbassador.email}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedAmbassador(null);
                            setCampaignData({
                              ...campaignData,
                              ambassadorId: null,
                            });
                          }}
                          className="w-8 h-8 bg-red-100 rounded-full items-center justify-center ml-3"
                        >
                          <Ionicons name="close" size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View>
                      <View className="relative">
                        <TextInput
                          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 pr-12 text-base text-gray-900"
                          placeholder="Search by email to assign ambassador..."
                          value={createAmbassadorSearch}
                          onChangeText={(text) => {
                            setCreateAmbassadorSearch(text);
                            searchAmbassadorForCreate(text);
                          }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          placeholderTextColor="#9CA3AF"
                        />
                        <View className="absolute right-4 top-4">
                          <Ionicons name="search" size={20} color="#9CA3AF" />
                        </View>
                      </View>

                      {/* Search Results */}
                      {createSearchedUsers.length > 0 && (
                        <View className="mt-3 max-h-48">
                          <ScrollView
                            className="bg-white border border-gray-200 rounded-xl"
                            showsVerticalScrollIndicator={false}
                          >
                            {createSearchedUsers.map((user) => (
                              <TouchableOpacity
                                key={user.id}
                                className="flex-row items-center p-4 border-b border-gray-100 active:bg-gray-50"
                                onPress={() => {
                                  setSelectedAmbassador(user);
                                  setCampaignData({
                                    ...campaignData,
                                    ambassadorId: user.id,
                                  });
                                  setCreateAmbassadorSearch("");
                                  setCreateSearchedUsers([]);
                                }}
                              >
                                <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-3 overflow-hidden">
                                  {user.photoUrl ? (
                                    <Image
                                      source={{ uri: user.photoUrl }}
                                      style={{ width: "100%", height: "100%" }}
                                      contentFit="cover"
                                    />
                                  ) : (
                                    <Text className="text-gray-600 font-gBold text-sm">
                                      {user.name.charAt(0).toUpperCase()}
                                    </Text>
                                  )}
                                </View>
                                <View className="flex-1">
                                  <Text className="font-gMedium text-gray-900 text-base">
                                    {user.name}
                                  </Text>
                                  <Text className="text-gray-500 text-sm">
                                    {user.email}
                                  </Text>
                                  {user.university && (
                                    <Text className="text-gray-400 text-xs">
                                      {user.university}
                                    </Text>
                                  )}
                                </View>
                                <View className="bg-blue-100 px-3 py-1 rounded-full">
                                  <Text className="text-blue-700 font-gBold text-xs">
                                    Select
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}

                  <Text className="text-gray-500 text-sm mt-2">
                    Assign a user as ambassador for this campaign. They'll get
                    special permissions to manage applicants and chat.
                  </Text>
                </View>
              </ScrollView>

              {/* Create Button */}
              <View className="p-6 border-t border-gray-100">
                <TouchableOpacity
                  className={`rounded-2xl py-4 items-center justify-center ${
                    uploading ? "bg-gray-400" : "bg-blue-500"
                  }`}
                  onPress={handleCreateCampaign}
                  disabled={uploading}
                >
                  <Text className="text-white text-lg font-semibold">
                    {uploading
                      ? editingCampaign
                        ? "Updating..."
                        : "Creating..."
                      : editingCampaign
                      ? "Update Campaign"
                      : "Create Campaign"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
                {/* <TouchableOpacity
                  onPress={() => {
                    s(false);
                    setTimeout(() => setCreateChatModalVisible(true), 300);
                  }}
                  className="w-10 h-10 bg-blue-500 rounded-full items-center justify-center"
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity> */}
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
                            `/(admin-tabs)/campaign/sub-chat?id=${item.id}` as any
                          );
                        } else {
                          router.push(
                            `/(admin-tabs)/campaign/campaign-chat?campaignId=${item.id}` as any
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
                        {item.type === "campaign" ? (
                          <View className="bg-green-100 rounded-full px-2 py-1 self-start">
                            <Text className="text-green-700 text-xs font-gBold">
                              Campaign
                            </Text>
                          </View>
                        ) : (
                          <View className="bg-blue-100 rounded-full px-2 py-1 self-start">
                            <Text className="text-blue-700 text-xs font-gBold">
                              Group Chat
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
                <Text className="text-gray-600 text-base mb-2">Chat Name</Text>
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
              </View>

              {/* Selected Users Count */}
              {selectedUsers.size > 0 && (
                <View className="mb-4 p-3 bg-blue-50 rounded-xl">
                  <Text className="text-blue-700 font-gMedium">
                    {selectedUsers.size} user{selectedUsers.size > 1 ? "s" : ""}{" "}
                    selected
                  </Text>
                </View>
              )}

              {/* Users List */}
              <View className="mb-6">
                {filteredUsers.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    className={`flex-row items-center p-3 rounded-xl mb-2 ${
                      selectedUsers.has(user.id) ? "bg-blue-100" : "bg-gray-50"
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

      {/* Ambassador Assignment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={ambassadorModalVisible}
        onRequestClose={() => setAmbassadorModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl h-4/5">
            <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
              <Text className="text-2xl font-bold text-gray-900">
                Assign Ambassador
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setAmbassadorModalVisible(false);
                  setSelectedUser(null);
                  setSelectedCampaignForAmbassador(null);
                  setUserSearchQuery("");
                  setSearchedUsers([]);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 p-6"
              showsVerticalScrollIndicator={false}
            >
              {/* User Search */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-3">
                  Search User
                </Text>
                <View className="relative">
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 pr-12 text-base text-gray-900"
                    placeholder="Enter user email..."
                    value={userSearchQuery}
                    onChangeText={(text) => {
                      setUserSearchQuery(text);
                      searchUsersByEmail(text);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#9CA3AF"
                  />
                  <View className="absolute right-4 top-4">
                    <Ionicons name="search" size={20} color="#9CA3AF" />
                  </View>
                </View>

                {/* Search Results */}
                {searchedUsers.length > 0 && (
                  <View className="mt-3 max-h-48">
                    <ScrollView
                      className="bg-white border border-gray-200 rounded-xl"
                      showsVerticalScrollIndicator={false}
                    >
                      {searchedUsers.map((user) => (
                        <TouchableOpacity
                          key={user.id}
                          onPress={() => {
                            setSelectedUser(user);
                            setUserSearchQuery(user.email);
                            setSearchedUsers([]);
                          }}
                          className={`flex-row items-center p-4 border-b border-gray-100 ${
                            selectedUser?.id === user.id ? "bg-blue-50" : ""
                          }`}
                        >
                          {user.photoUrl ? (
                            <Image
                              source={{ uri: user.photoUrl }}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginRight: 12,
                              }}
                            />
                          ) : (
                            <View className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center mr-3">
                              <Ionicons
                                name="person"
                                size={20}
                                color="#6B7280"
                              />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="font-medium text-gray-900">
                              {user.name}
                            </Text>
                            <Text className="text-sm text-gray-500">
                              {user.email}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Selected User */}
              {selectedUser && (
                <View className="mb-6 p-4 bg-blue-50 rounded-xl">
                  <Text className="text-sm font-medium text-blue-600 mb-2">
                    Selected User:
                  </Text>
                  <View className="flex-row items-center">
                    {selectedUser.photoUrl ? (
                      <Image
                        source={{ uri: selectedUser.photoUrl }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          marginRight: 12,
                        }}
                      />
                    ) : (
                      <View className="w-12 h-12 bg-blue-200 rounded-full items-center justify-center mr-3">
                        <Ionicons name="person" size={20} color="#3B82F6" />
                      </View>
                    )}
                    <View>
                      <Text className="font-semibold text-blue-900">
                        {selectedUser.name}
                      </Text>
                      <Text className="text-blue-600">
                        {selectedUser.email}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Campaign Selection */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-3">
                  Select Campaign
                </Text>
                <View className="max-h-64">
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {campaigns.map((campaign) => (
                      <TouchableOpacity
                        key={campaign.id}
                        onPress={() =>
                          setSelectedCampaignForAmbassador(campaign)
                        }
                        className={`p-4 rounded-xl mb-3 border ${
                          selectedCampaignForAmbassador?.id === campaign.id
                            ? "bg-green-50 border-green-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <View className="flex-row items-center">
                          {campaign.photoUrl ? (
                            <Image
                              source={{ uri: campaign.photoUrl }}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                marginRight: 12,
                              }}
                            />
                          ) : (
                            <View
                              className="w-12 h-12 rounded-lg items-center justify-center mr-3"
                              style={{ backgroundColor: campaign.brandColor }}
                            >
                              <Ionicons
                                name="megaphone"
                                size={20}
                                color="white"
                              />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text
                              className={`font-semibold ${
                                selectedCampaignForAmbassador?.id ===
                                campaign.id
                                  ? "text-green-900"
                                  : "text-gray-900"
                              }`}
                            >
                              {campaign.title}
                            </Text>
                            <Text
                              className={`text-sm ${
                                selectedCampaignForAmbassador?.id ===
                                campaign.id
                                  ? "text-green-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {campaign.type}
                            </Text>
                          </View>
                          {selectedCampaignForAmbassador?.id ===
                            campaign.id && (
                            <Ionicons
                              name="checkmark-circle"
                              size={24}
                              color="#10B981"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Assign Button */}
              <TouchableOpacity
                onPress={assignAmbassador}
                disabled={
                  !selectedUser ||
                  !selectedCampaignForAmbassador ||
                  assigningAmbassador
                }
                className={`p-4 rounded-xl items-center ${
                  selectedUser &&
                  selectedCampaignForAmbassador &&
                  !assigningAmbassador
                    ? "bg-green-500"
                    : "bg-gray-300"
                }`}
              >
                {assigningAmbassador ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Assigning...
                    </Text>
                  </View>
                ) : (
                  <Text
                    className={`font-semibold ${
                      selectedUser && selectedCampaignForAmbassador
                        ? "text-white"
                        : "text-gray-500"
                    }`}
                  >
                    Assign Ambassador
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default campaigns;
