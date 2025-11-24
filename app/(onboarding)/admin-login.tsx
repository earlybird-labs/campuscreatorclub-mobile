import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import CsccBlackLogoSmallSvg from "@/assets/svgs/CccBlackLogoSmall";
import { Ionicons } from "@expo/vector-icons";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  AppleAuthProvider,
} from "@react-native-firebase/auth";
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";
import { router } from "expo-router";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { appleAuth } from "@invertase/react-native-apple-authentication";
import { Image } from "expo-image";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAmbassadorLogin, setIsAmbassadorLogin] = useState(false);

  const auth = getAuth();
  const db = getFirestore();

  const verifyUserRole = async (user: any) => {
    // Get user data from Firestore to check permissions
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      Alert.alert("Error", "User data not found. Please contact support.");
      await auth.signOut();
      return false;
    }

    const userData = userDoc.data();

    if (isAmbassadorLogin) {
      // Ambassador login verification
      if (!userData?.isAmbassador) {
        Alert.alert(
          "Access Denied",
          "You don't have ambassador privileges. Please contact an admin if you believe this is an error."
        );
        await auth.signOut();
        return false;
      }

      // Navigate to ambassador tabs
      router.replace("/(ambassador-tabs)/campaign-chat" as any);
      return true;
    } else {
      // Admin login verification
      if (!userData?.isAdmin && userData?.role !== "admin") {
        Alert.alert(
          "Access Denied",
          "You don't have admin privileges. Please contact support."
        );
        await auth.signOut();
        return false;
      }

      // Navigate to admin tabs
      router.replace("/(admin-tabs)/home" as any);
      return true;
    }
  };

  const handleAdminLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      // First authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await verifyUserRole(user);
    } catch (error: any) {
      console.error("[LOGIN ERROR]", error);
      Alert.alert(
        "Login Failed",
        `Invalid ${
          isAmbassadorLogin ? "ambassador" : "admin"
        } credentials. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const response = await GoogleSignin.signIn();
      const { data } = response;

      if (!data?.idToken) {
        Alert.alert("Error", "Google sign-in failed. Please try again.");
        return;
      }

      const googleCredential = GoogleAuthProvider.credential(data.idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      const user = userCredential.user;

      await verifyUserRole(user);
    } catch (error: any) {
      console.error("[GOOGLE LOGIN ERROR]", error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
        return;
      }
      Alert.alert(
        "Google Sign-In Failed",
        "Failed to sign in with Google. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    setLoading(true);
    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      if (!appleAuthRequestResponse.identityToken) {
        Alert.alert("Error", "Apple sign-in failed. Please try again.");
        return;
      }

      const { identityToken, nonce } = appleAuthRequestResponse;
      const appleCredential = AppleAuthProvider.credential(
        identityToken,
        nonce
      );
      const userCredential = await signInWithCredential(auth, appleCredential);
      const user = userCredential.user;

      await verifyUserRole(user);
    } catch (error: any) {
      console.error("[APPLE LOGIN ERROR]", error);
      if (error.code === "ERR_CANCELED") {
        // User cancelled the login flow
        return;
      }
      Alert.alert(
        "Apple Sign-In Failed",
        "Failed to sign in with Apple. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View className="flex-1 px-6 pt-6">
            <CsccBlackLogoSmallSvg />
            <View className="mt-8">
              <Text className="text-black text-[35px] font-gBold">
                Welcome Back —
              </Text>
              <Text className="text-black text-[35px] font-gBold">
                {isAmbassadorLogin ? "Ambassador" : "Admin"}
              </Text>
            </View>

            <View className="mt-8 gap-y-4">
              <TextInput
                placeholder={
                  isAmbassadorLogin ? "Ambassador email" : "Admin email"
                }
                placeholderTextColor="#888"
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-5 text-base text-black"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4">
                <TextInput
                  placeholder={
                    isAmbassadorLogin ? "Ambassador password" : "Admin password"
                  }
                  placeholderTextColor="#888"
                  className="flex-1 py-5 text-base text-black"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={22}
                    color="#888"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Ambassador/Admin Toggle */}
            <View className="mt-6">
              <TouchableOpacity
                onPress={() => setIsAmbassadorLogin(!isAmbassadorLogin)}
                className="flex-row items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
                      isAmbassadorLogin
                        ? "border-green-500 bg-green-500"
                        : "border-gray-300"
                    }`}
                  >
                    {isAmbassadorLogin && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <View>
                    <Text className="text-gray-900 font-medium text-base">
                      Login as Ambassador
                    </Text>
                    <Text className="text-gray-500 text-sm">
                      {isAmbassadorLogin
                        ? "Switch to admin login"
                        : "Switch to ambassador login"}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isAmbassadorLogin ? "people" : "shield-checkmark"}
                  size={24}
                  color={isAmbassadorLogin ? "#10B981" : "#6476E8"}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className={`mt-6 rounded-xl py-4 items-center ${
                loading
                  ? "bg-gray-400"
                  : isAmbassadorLogin
                  ? "bg-green-500"
                  : "bg-[#6476E8]"
              }`}
              onPress={handleAdminLogin}
              disabled={loading}
            >
              <Text className="text-white font-gBold text-lg">
                {loading
                  ? "Signing in..."
                  : isAmbassadorLogin
                  ? "Ambassador Sign In"
                  : "Admin Sign In"}
              </Text>
            </TouchableOpacity>

            {/* OR Divider */}
            <View className="flex-row items-center mt-6 mb-4">
              <View className="flex-1 h-px bg-gray-300" />
              <Text className="mx-4 text-gray-500 font-gMedium">OR</Text>
              <View className="flex-1 h-px bg-gray-300" />
            </View>

            {/* OAuth Sign-In Buttons */}
            <View className="gap-y-3">
              {Platform.OS === "ios" && (
                <TouchableOpacity
                  onPress={signInWithApple}
                  disabled={loading}
                  className={`flex-row items-center bg-white border border-[#E5E5E5] rounded-xl py-4 px-4 justify-center ${
                    loading ? "opacity-50" : ""
                  }`}
                >
                  <Image
                    source={require("@/assets/icons/apple.png")}
                    style={{ width: 16, height: 20, marginRight: 12 }}
                  />
                  <Text className="text-black font-gMedium text-base">
                    signin with Apple
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={signInWithGoogle}
                disabled={loading}
                className={`flex-row items-center bg-white border border-[#E5E5E5] rounded-xl py-4 px-4 justify-center ${
                  loading ? "opacity-50" : ""
                }`}
              >
                <Image
                  source={require("@/assets/icons/google.png")}
                  style={{ width: 18, height: 18, marginRight: 12 }}
                />
                <Text className="text-black font-gMedium text-base">
                  signin with Google
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AdminLogin;
