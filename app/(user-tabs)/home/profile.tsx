import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import storage from "@react-native-firebase/storage";
import React, { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  getAuth,
  signOut,
  deleteUser,
  sendPasswordResetEmail,
} from "@react-native-firebase/auth";
import { softDeleteAccount } from "@/services/accountService";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  addDoc,
  serverTimestamp,
  deleteDoc,
} from "@react-native-firebase/firestore";
import { router } from "expo-router";
// import { useVideoPlayer, VideoView } from "expo-video";

const profile = () => {
  const auth = getAuth();
  const db = getFirestore();
  const currentUser = auth.currentUser;

  const [user, setUser] = useState<any>(null);
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  // const [portfolio, setPortfolio] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBio, setSavingBio] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUniversity, setEditUniversity] = useState("");
  const [editTiktok, setEditTiktok] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  // const [uploadingVideo, setUploadingVideo] = useState(false);
  // const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  // const [videoModalVisible, setVideoModalVisible] = useState(false);
  // const [selectedVideo, setSelectedVideo] = useState<any>(null);

  // Check if user signed up with email/password (not Google/Apple)
  const isEmailPasswordUser = () => {
    if (!currentUser?.providerData) return false;
    return currentUser.providerData.some(
      (provider) => provider.providerId === "password"
    );
  };

  // Fetch user profile data
  useEffect(() => {
    if (!currentUser) return;
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData) {
          setUser(userData);
          setBio(userData.bio || "");
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [currentUser]);

  // Fetch portfolio items (videos/images)
  // useEffect(() => {
  //   if (!currentUser) return;
  //   const q = query(
  //     collection(db, "portfolio"),
  //     where("userId", "==", currentUser.uid)
  //   );
  //   const unsubscribe = onSnapshot(q, (querySnapshot) => {
  //     const items: any[] = [];
  //     querySnapshot.forEach((doc) => {
  //       items.push({ id: doc.id, ...doc.data() });
  //     });
  //     setPortfolio(items);
  //   });
  //   return () => unsubscribe();
  // }, [currentUser]);

  useEffect(() => {
    if (user) {
      setEditName(user.name || "");
      setEditUniversity(user.university || "");
      setEditTiktok(user.tiktok || "");
      setEditInstagram(user.instagram || "");
    }
  }, [user]);

  // Save bio to Firestore
  const handleSaveBio = async () => {
    if (!currentUser) return;
    setSavingBio(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), { bio });

      // Update local user state immediately to reflect changes
      setUser((prevUser: any) => ({
        ...prevUser,
        bio,
      }));

      setEditingBio(false);
    } catch (e) {
      // Optionally show error
    }
    setSavingBio(false);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setSavingProfile(true);
    try {
      let photoUrl = user.photoUrl;

      // Upload new image if one was selected
      if (newImageUri) {
        photoUrl = await uploadImage(newImageUri);
      }

      const updatedData = {
        name: editName,
        university: editUniversity,
        tiktok: editTiktok,
        instagram: editInstagram,
        ...(photoUrl && { photoUrl }),
      };

      await updateDoc(doc(db, "users", currentUser.uid), updatedData);

      // Update local user state immediately to reflect changes
      setUser((prevUser: any) => ({
        ...prevUser,
        ...updatedData,
      }));

      setEditingProfile(false);
      setNewImageUri(null);
    } catch (e) {
      Alert.alert("Error", "Failed to save profile. Please try again.");
    }
    setSavingProfile(false);
  };

  const selectImage = async () => {
    Alert.alert(
      "Select Photo",
      "Choose how you'd like to select your profile picture",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: openCamera },
        { text: "Photo Library", onPress: openImagePicker },
      ]
    );
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Camera permission is required to take photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setNewImageUri(result.assets[0].uri);
    }
  };

  const openImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Photo library permission is required to select photos."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setNewImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    setUploadingImage(true);
    try {
      // If it's already a remote URL, skip upload
      if (uri.startsWith("http")) {
        return uri;
      }

      const filename = `profile_pictures/${currentUser?.uid}_${Date.now()}.jpg`;
      const reference = storage().ref(filename);
      await reference.putFile(uri);
      const downloadURL = await reference.getDownloadURL();
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Error", "Failed to upload image. Please try again.");
      throw error;
    } finally {
      setUploadingImage(false);
    }
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

  const handlePasswordReset = async () => {
    if (!currentUser?.email) {
      Alert.alert("Error", "No email address found for your account.");
      return;
    }

    Alert.alert(
      "Reset Password",
      `A password reset email will be sent to ${currentUser.email}. You will need to sign in again after resetting your password.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Send Reset Email",
          onPress: async () => {
            setSendingPasswordReset(true);
            try {
              await sendPasswordResetEmail(auth, currentUser.email!);
              Alert.alert(
                "Password Reset Email Sent",
                `Check your email (${currentUser.email}) for instructions to reset your password.`,
                [
                  {
                    text: "OK",
                    onPress: async () => {
                      // Sign out user so they can sign in with new password
                      await signOut(auth);
                      router.replace("/signin");
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error("Error sending password reset email:", error);
              let errorMessage =
                "Failed to send password reset email. Please try again.";

              if (error.code === "auth/user-not-found") {
                errorMessage = "No account found with this email address.";
              } else if (error.code === "auth/invalid-email") {
                errorMessage = "Invalid email address.";
              } else if (error.code === "auth/too-many-requests") {
                errorMessage =
                  "Too many password reset attempts. Please try again later.";
              }

              Alert.alert("Error", errorMessage);
            } finally {
              setSendingPasswordReset(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Deactivate Account",
      "This will temporarily deactivate your account. Your data will be kept for 30 days, during which you can reactivate by signing in again. After 30 days, your account and all data will be permanently deleted.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Deactivate Account",
          style: "destructive",
          onPress: async () => {
            try {
              if (!currentUser) return;

              // Get current user data first
              const userDoc = await getDoc(doc(db, "users", currentUser.uid));
              if (!userDoc.exists()) {
                Alert.alert("Error", "User data not found");
                return;
              }

              const userData = userDoc.data();

              // Soft delete the account (no loading alert to avoid overlap)
              const success = await softDeleteAccount(
                currentUser.uid,
                userData
              );

              if (success) {
                // Sign out user first
                await signOut(auth);

                // Show success alert with navigation on OK press
                Alert.alert(
                  "Account Deactivated",
                  "Your account has been deactivated. You can reactivate it by signing in again within 30 days. After that, it will be permanently deleted.",
                  [
                    {
                      text: "OK",
                      onPress: () => router.replace("/signin"),
                    },
                  ],
                  { cancelable: false }
                );
              } else {
                Alert.alert(
                  "Error",
                  "Failed to deactivate account. Please try again."
                );
              }
            } catch (error) {
              console.error("Error deactivating account:", error);
              Alert.alert(
                "Error",
                "Failed to deactivate account. Please try again or contact support if the problem persists."
              );
            }
          },
        },
      ]
    );
  };

  if (loading || !user) {
    return (
      <SafeAreaView
        edges={["top"]}
        className="flex-1 bg-white justify-center items-center"
      >
        <ActivityIndicator size="large" color="#6476E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 mb-2">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#222" />
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-white rounded-full p-3 shadow border border-gray-200"
            onPress={() => setEditingProfile((prev) => !prev)}
          >
            <Ionicons name="pencil" size={22} color="#222" />
          </TouchableOpacity>
        </View>

        {/* Profile Image & Name */}
        <View className="items-center mt-2 mb-2">
          <View className="relative">
            <View className="w-28 h-28 rounded-full overflow-hidden bg-gray-200 items-center justify-center mb-2">
              {newImageUri || user.photoUrl ? (
                <Image
                  source={{
                    uri: newImageUri || user.photoUrl,
                  }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : user.name ? (
                <View className="bg-blue-500 w-full h-full items-center justify-center">
                  <Text className="text-white font-gBold text-4xl">
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              ) : (
                <Ionicons name="person" size={40} color="#6B7280" />
              )}
            </View>
            {editingProfile && (
              <TouchableOpacity
                className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-2 shadow-lg"
                onPress={selectImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="camera" size={20} color="white" />
                )}
              </TouchableOpacity>
            )}
          </View>
          {editingProfile ? (
            <>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-gBold text-xl text-center mt-2 mb-2 min-w-[200px]"
                placeholder="Enter your name"
                placeholderTextColor="#888"
                autoFocus={!user.name}
              />
              <View className="flex-row items-center mt-2 space-x-2 justify-center">
                <TextInput
                  value={editUniversity}
                  onChangeText={setEditUniversity}
                  className="bg-gray-100 rounded-xl px-3 py-1 text-gray-700 font-gMedium min-w-[120px]"
                  placeholder="University"
                  placeholderTextColor="#888"
                />
                <TextInput
                  value={editTiktok}
                  onChangeText={setEditTiktok}
                  className="bg-white rounded-full px-2 py-1 border border-gray-200 ml-1 text-gray-700 font-gMedium min-w-[100px]"
                  placeholder="TikTok @username"
                  placeholderTextColor="#888"
                />
                <TextInput
                  value={editInstagram}
                  onChangeText={setEditInstagram}
                  className="bg-white rounded-full px-2 py-1 border border-gray-200 ml-1 text-gray-700 font-gMedium min-w-[100px]"
                  placeholder="Instagram @username"
                  placeholderTextColor="#888"
                />
              </View>
              <TouchableOpacity
                className={`bg-[#6476E8] rounded-xl py-3 items-center mt-4 w-40 self-center ${
                  savingProfile || uploadingImage ? "opacity-60" : ""
                }`}
                onPress={handleSaveProfile}
                disabled={savingProfile || uploadingImage}
              >
                <Text className="text-white font-gBold text-base">
                  {savingProfile
                    ? "Saving..."
                    : uploadingImage
                    ? "Uploading..."
                    : "Save"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {user.name ? (
                <Text className="font-gBold text-3xl mt-2">{user.name}</Text>
              ) : (
                <TouchableOpacity
                  onPress={() => setEditingProfile(true)}
                  className="mt-2"
                >
                  <Text className="font-gBold text-3xl text-gray-400">
                    Enter your name
                  </Text>
                </TouchableOpacity>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  alignItems: "center",
                  paddingHorizontal: 0,
                }}
                className="mt-2"
              >
                <View className="flex-row items-center space-x-2">
                  {user.username && (
                    <View className="bg-gray-100 rounded-xl px-3 py-1 flex-row items-center">
                      <Text className="text-gray-700 font-gMedium">
                        @{user.username}
                      </Text>
                    </View>
                  )}
                  {user.university && (
                    <View className="bg-gray-100 rounded-xl px-3 py-1 flex-row items-center ml-2">
                      <Ionicons
                        name="school"
                        size={16}
                        color="#888"
                        style={{ marginRight: 4 }}
                      />
                      <Text className="text-gray-700 font-gMedium">
                        {user.university}
                      </Text>
                    </View>
                  )}
                  {user.tiktok && (
                    <TouchableOpacity
                      className="bg-white rounded-full px-2 py-1 border border-gray-200 ml-2 flex-row items-center"
                      onPress={() =>
                        Linking.openURL(
                          `https://tiktok.com/@${user.tiktok.replace(/^@/, "")}`
                        )
                      }
                    >
                      <Ionicons name="logo-tiktok" size={20} color="#000" />
                      <Text className="ml-1 text-gray-700 font-gMedium">
                        @{user.tiktok.replace(/^@/, "")}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {user.instagram && (
                    <TouchableOpacity
                      className="bg-white rounded-full px-2 py-1 border border-gray-200 ml-2 flex-row items-center"
                      onPress={() =>
                        Linking.openURL(
                          `https://instagram.com/${user.instagram.replace(
                            /^@/,
                            ""
                          )}`
                        )
                      }
                    >
                      <Ionicons
                        name="logo-instagram"
                        size={20}
                        color="#C13584"
                      />
                      <Text className="ml-1 text-gray-700 font-gMedium">
                        @{user.instagram.replace(/^@/, "")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </>
          )}
        </View>

        {/* Bio */}
        <View className="mx-5 mt-4 mb-2">
          {editingBio ? (
            <>
              <TextInput
                value={bio}
                onChangeText={setBio}
                multiline
                className="bg-gray-50 rounded-2xl p-4 text-base text-gray-800 border border-gray-200"
                style={{ minHeight: 80 }}
              />
              <TouchableOpacity
                className={`bg-[#6476E8] rounded-xl py-3 items-center mt-3 ${
                  savingBio ? "opacity-60" : ""
                }`}
                onPress={handleSaveBio}
                disabled={savingBio}
              >
                <Text className="text-white font-gBold text-base">
                  {savingBio ? "Saving..." : "Save bio"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View className="bg-gray-50 rounded-2xl p-4 min-h-[80px] justify-center relative">
              {bio && bio.trim().length > 0 ? (
                <Text className="text-gray-800 text-base leading-6">{bio}</Text>
              ) : (
                <Text className="text-gray-400 text-base leading-6">
                  Write something about yourself...
                </Text>
              )}
              <TouchableOpacity
                className="absolute top-2 right-2 p-2"
                onPress={() => setEditingBio(true)}
              >
                <Ionicons name="pencil" size={18} color="#6476E8" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Portfolio */}
        {/* <View className="mx-5 mt-4">
          <Text className="font-gBold text-2xl mb-3">Portfolio</Text>
          <View className="flex-row flex-wrap -mx-1">
            {portfolio.length === 0 ? (
              <Text className="text-gray-400 text-center w-full py-8">
                No portfolio items yet.
              </Text>
            ) : (
              portfolio.map((item, idx) => (
                <View
                  key={item.id}
                  className="w-1/2 px-1 mb-3"
                  style={{ maxWidth: "50%" }}
                >
                  <View className="rounded-2xl overflow-hidden bg-gray-200 relative">
                    {item.type === "video" && item.videoUrl ? (
                      <TouchableOpacity
                        onPress={() => handleVideoPress(item)}
                        activeOpacity={0.8}
                      >
                        <View className="relative">
                          <View className="w-full h-40 bg-gray-300 items-center justify-center">
                            <Ionicons
                              name="play-circle"
                              size={60}
                              color="white"
                            />
                          </View>
                          <View className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-1">
                            <Text className="text-white text-xs font-gMedium">
                              VIDEO
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <Image
                        source={{
                          uri:
                            item.imageUrl ||
                            item.thumbnailUrl ||
                            "https://via.placeholder.com/300x200?text=No+Image",
                        }}
                        className="w-full h-40"
                        contentFit="cover"
                      />
                    )}
                    <View className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2">
                      <Text
                        className="text-white font-gMedium text-sm"
                        numberOfLines={2}
                      >
                        {item.title || "Untitled"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
          <TouchableOpacity
            className={`flex-row items-center justify-center bg-gray-50 border border-gray-200 rounded-2xl py-4 mt-2 ${
              uploadingVideo ? "opacity-60" : ""
            }`}
            onPress={selectVideo}
            disabled={uploadingVideo}
          >
            {uploadingVideo ? (
              <>
                <ActivityIndicator size="small" color="#6476E8" />
                <Text className="ml-2 text-gray-700 font-gMedium text-base">
                  Uploading... {videoUploadProgress}%
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="add" size={24} color="#888" />
                <Text className="ml-2 text-gray-700 font-gMedium text-base">
                  Add Video
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View> */}
      </ScrollView>

      {/* Sign Out & Delete Account Buttons - Fixed at bottom */}
      <View className="px-5 pb-8 pt-4 gap-y-3">
        <TouchableOpacity
          className="bg-red-100 rounded-xl py-4 items-center"
          onPress={handleLogout}
        >
          <Ionicons name="exit-outline" size={22} color="#DC2626" />
          <Text className="text-red-600 font-gBold text-base mt-1">
            Sign Out
          </Text>
        </TouchableOpacity>

        {/* Password Reset Button - Only for email/password users */}
        {isEmailPasswordUser() && (
          <TouchableOpacity
            className={`bg-blue-100 rounded-xl py-4 items-center ${
              sendingPasswordReset ? "opacity-60" : ""
            }`}
            onPress={handlePasswordReset}
            disabled={sendingPasswordReset}
          >
            {sendingPasswordReset ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Ionicons name="key-outline" size={22} color="#2563EB" />
            )}
            <Text className="text-blue-600 font-gBold text-base mt-1">
              {sendingPasswordReset ? "Sending..." : "Reset Password"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          className="bg-gray-100 border border-red-200 rounded-xl py-4 items-center"
          onPress={handleDeleteAccount}
        >
          <Ionicons name="trash-outline" size={22} color="#DC2626" />
          <Text className="text-red-600 font-gMedium text-base mt-1">
            Delete Account
          </Text>
        </TouchableOpacity>
      </View>

      {/* Video Playback Modal */}
      {/* <Modal
        visible={videoModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseVideo}
      >
        <SafeAreaView edges={["top"]} className="flex-1 bg-black">
          {/* Header */}
      {/* <View className="flex-row items-center justify-between p-4">
            <TouchableOpacity onPress={handleCloseVideo}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <Text
              className="text-white font-gBold text-lg flex-1 text-center px-4"
              numberOfLines={1}
            >
              {selectedVideo?.title || "Video"}
            </Text>
            <View style={{ width: 28 }} />
          </View> */}

      {/* Video Player */}
      {/* {selectedVideo?.videoUrl && (
            <VideoView
              player={videoPlayer}
              style={{ flex: 1 }}
              allowsFullscreen
              allowsPictureInPicture
              nativeControls
              contentFit="contain"
            />
          )} */}
      {/* </SafeAreaView>
      </Modal> */}
    </SafeAreaView>
  );
};

export default profile;
