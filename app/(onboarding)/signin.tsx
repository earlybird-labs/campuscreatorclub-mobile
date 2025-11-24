import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import CsccBlackLogoSmallSvg from "@/assets/svgs/CccBlackLogoSmall";
import { router, usePathname } from "expo-router";
import { useFormik } from "formik";
import signinValidationSchema from "@/validations/signin-validation";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  AppleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { appleAuth } from "@invertase/react-native-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
} from "@react-native-firebase/firestore";
import {
  checkDeletedUser,
  restoreAccount,
} from "../../services/accountService";
import { trackLogin, trackRegistrationComplete } from "@/utils/appsFlyerEvents";
import DatePicker from "react-native-date-picker";
import collegeData from "@/data/college-data.json";
import PhoneInput, { ICountry } from "react-native-international-phone-number";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthError extends Error {
  code?: string;
}
const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const signin = () => {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [birthdayDate, setBirthdayDate] = useState(new Date());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [universitySuggestions, setUniversitySuggestions] = useState<string[]>(
    []
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<null | ICountry>(null);
  const [isEmailSignup, setIsEmailSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [userData, setUserData] = useState({
    email: "",
    name: "",
    phoneNumber: "",
    fullPhoneNumber: "",
    birthday: new Date(),
    university: "",
    password: "",
    confirmPassword: "",
    instagram: "",
    tiktok: "",
    photo: "",
  });
  const auth = getAuth();
  const db = getFirestore();

  // Filter universities based on user input
  const filterUniversities = (text: string) => {
    if (text.length < 2) {
      setUniversitySuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const searchTerm = text.toLowerCase();

    // Filter and sort: prioritize matches that start with the search term
    const filtered = collegeData.colleges
      .filter((college) => college.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aStartsWith = aLower.startsWith(searchTerm);
        const bStartsWith = bLower.startsWith(searchTerm);

        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return a.localeCompare(b);
      });

    setUniversitySuggestions(filtered.slice(0, 3)); // Show max 3 suggestions
    setShowSuggestions(filtered.length > 0);
  };

  const handleUniversityChange = (text: string) => {
    setUserData({ ...userData, university: text });
    filterUniversities(text);
  };

  const selectUniversity = (university: string) => {
    // Clear any pending hide timeouts
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
    setUserData({ ...userData, university });
    setShowSuggestions(false);
    setUniversitySuggestions([]);
  };

  const hideSuggestions = () => {
    setShowSuggestions(false);
    setHideTimeout(null);
  };

  // Handle Apple display name persistence
  const handleAppleDisplayName = async (user: any) => {
    try {
      if (user.displayName) {
        // Store display name if available
        await AsyncStorage.setItem("apple_display_name", user.displayName);
        console.log("Stored Apple display name:", user.displayName);
        return user.displayName;
      } else {
        // Try to retrieve stored display name if current is null
        const storedName = await AsyncStorage.getItem("apple_display_name");
        if (storedName) {
          console.log("Retrieved stored Apple display name:", storedName);
          return storedName;
        }
      }
    } catch (error) {
      console.error("Error handling Apple display name:", error);
    }
    return user.displayName;
  };
  const {
    values,
    errors,
    touched,
    handleBlur,
    handleChange,
    resetForm,
    handleSubmit,
  } = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema: signinValidationSchema,
    onSubmit: async (values) => {
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          values.email,
          values.password
        );

        if (userCredential.user) {
          // Check if user has completed onboarding
          const userDoc = await getDoc(
            doc(db, "users", userCredential.user.uid)
          );

          if (userDoc.exists() && userDoc.data()?.hasCompletedOnboarding) {
            const userData = userDoc.data();
            // Only track login for regular users (not admin/ambassador)
            if (userData?.role === "user" && !userData?.isAmbassador && !userData?.isAdmin) {
              trackLogin(userCredential.user.uid, "email");
            }
            router.replace("/(user-tabs)/home" as any);
          } else {
            // User needs to complete profile
            const displayName = await handleAppleDisplayName(
              userCredential.user
            );
            setCurrentUser(userCredential.user);
            setUserData({
              ...userData,
              email: userCredential.user.email ?? "",
              name: displayName ?? "",
              photo: userCredential.user.photoURL ?? "",
            });
            setShowModal(true);
          }
        }
      } catch (error: any) {
        console.error("[EMAIL SIGNIN ERROR]", error);

        // Show simple error alert
        Alert.alert(
          "Sign In Failed",
          "The credentials are either wrong or you don't have an account yet.",
          [
            {
              text: "Try again",
              style: "cancel",
            },
          ]
        );
      }
    },
  });

  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        "871302192650-ccomi06nhbb0gejcaisqsi780ev84jun.apps.googleusercontent.com",
    });

    // signOut(auth);
  }, []);

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const response = await GoogleSignin.signIn();
      const { accessToken, idToken } = await GoogleSignin.getTokens();

      if (!idToken) {
        throw new Error("No ID token received from Google Sign-In");
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      return userCredential;
    } catch (error) {
      const err = error as AuthError;
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("Sign-in cancelled");
      } else if (err.code === statusCodes.IN_PROGRESS) {
        Alert.alert("Sign-in in progress...");
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Google Play Services not available");
      } else {
        Alert.alert("Something went wrong", err.message);
      }
    }
  };

  const signInWithApple = async () => {
    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });
      const { identityToken, nonce, fullName } = appleAuthRequestResponse;
      const appleCredential = AppleAuthProvider.credential(
        identityToken,
        nonce
      );
      const userCredential = await signInWithCredential(auth, appleCredential);
      return userCredential;
    } catch (error) {
      console.log("[ERROR]", error);
    }
  };

  useEffect(() => {
    const subscriber = auth.onAuthStateChanged(async (user) => {
      if (user !== null && user !== undefined) {
        try {
          // Handle Apple display name persistence
          const displayName = await handleAppleDisplayName(user);

          // Check if user exists in deleted_users collection first
          const deletedUser = await checkDeletedUser(user.uid);

          if (deletedUser) {
            // User is in deleted_users collection, offer recovery
            Alert.alert(
              "Account Recovery",
              "We found your deleted account. Would you like to recover it?",
              [
                {
                  text: "No",
                  style: "cancel",
                  onPress: async () => {
                    await auth.signOut();
                  },
                },
                {
                  text: "Recover Account",
                  onPress: async () => {
                    const success = await restoreAccount(user.uid);
                    if (success) {
                      Alert.alert(
                        "Success",
                        "Your account has been recovered!"
                      );
                      // Continue with normal flow - the user doc should now exist
                      const restoredUserDoc = await getDoc(
                        doc(db, "users", user.uid)
                      );
                      if (restoredUserDoc.exists()) {
                        const userData = restoredUserDoc.data();

                        if (pathname === "/admin-login") {
                          if (userData?.role === "admin" || userData?.isAdmin) {
                            router.replace("/(admin-tabs)/home" as any);
                          } else if (userData?.isAmbassador) {
                            return;
                          } else {
                            Alert.alert(
                              "Access Denied",
                              "You don't have admin or ambassador privileges."
                            );
                            await auth.signOut();
                            return;
                          }
                        } else {
                          if (userData?.role === "admin") {
                            router.replace("/(admin-tabs)/home" as any);
                          } else {
                            // Track login for regular users
                            trackLogin(user.uid, "recovered");
                            router.replace("/(user-tabs)/home" as any);
                          }
                        }
                      }
                    } else {
                      Alert.alert(
                        "Error",
                        "Failed to recover account. Please try again."
                      );
                      await auth.signOut();
                    }
                  },
                },
              ]
            );
            return;
          }

          const userDoc = await getDoc(doc(db, "users", user.uid));

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Check if user has completed onboarding
            if (!userData?.hasCompletedOnboarding) {
              console.log("User has not completed onboarding, showing modal");
              setCurrentUser(user);
              setUserData({
                email: user.email ?? "",
                name: displayName ?? "",
                phoneNumber: "",
                fullPhoneNumber: "",
                birthday: new Date(),
                university: "",
                password: "",
                confirmPassword: "",
                instagram: "",
                tiktok: "",
                photo: user.photoURL ?? "",
              });
              setShowModal(true);
              return;
            }

            // Check if user is coming from admin-login page
            if (pathname === "/admin-login") {
              // Check role for admin-login users - handle both admin and ambassador
              if (userData?.role === "admin" || userData?.isAdmin) {
                router.replace("/(admin-tabs)/home" as any);
              } else if (userData?.isAmbassador) {
                // Ambassador login - already handled by admin-login.tsx, just return
                return;
              } else {
                // User is neither admin nor ambassador, show access denied and sign out
                Alert.alert(
                  "Access Denied",
                  "You don't have admin or ambassador privileges."
                );
                await auth.signOut();
                return;
              }
            } else {
              // Regular user flow - check if they have admin role
              if (userData?.role === "admin") {
                router.replace("/(admin-tabs)/home" as any);
              } else {
                // Track login for regular users - detect provider
                const providerId = user.providerData[0]?.providerId || "email";
                const loginMethod = providerId === "google.com" ? "google" : providerId === "apple.com" ? "apple" : "email";
                trackLogin(user.uid, loginMethod);
                router.replace("/(user-tabs)/home" as any);
              }
            }
          } else {
            // User exists in auth but not in Firestore (incomplete onboarding)
            console.log(
              "User not found in Firestore, showing onboarding modal"
            );
            setCurrentUser(user);
            setUserData({
              email: user.email ?? "",
              name: displayName ?? "",
              phoneNumber: "",
              fullPhoneNumber: "",
              birthday: new Date(),
              university: "",
              password: "",
              confirmPassword: "",
              instagram: "",
              tiktok: "",
              photo: user.photoURL ?? "",
            });
            setShowModal(true);
          }
        } catch (error) {
          console.log("[ERROR]", error);
        }
      }
    });

    return subscriber;
  }, [pathname]);

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }
    
    setSendingResetEmail(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      Alert.alert(
        "Password Reset Email Sent",
        `A password reset link has been sent to ${resetEmail}. Please check your inbox and spam folder.`,
        [
          {
            text: "OK",
            onPress: () => {
              setShowForgotPasswordModal(false);
              setResetEmail("");
            }
          }
        ]
      );
    } catch (error: any) {
      // Handle specific error cases
      let errorMessage = "Failed to send reset email. Please try again.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleCompleteProfile = async () => {
    try {
      let user = currentUser;
      
      // For email signup, validate passwords and create account
      if (isEmailSignup) {
        if (userData.password !== userData.confirmPassword) {
          Alert.alert("Error", "Passwords do not match");
          return;
        }

        if (userData.password.length < 6) {
          Alert.alert("Error", "Password must be at least 6 characters");
          return;
        }

        // Create account with email and password
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          userData.email,
          userData.password
        );

        if (!userCredential.user) {
          throw new Error("Failed to create account");
        }

        user = userCredential.user;
      }

      // Use stored Apple display name if available
      const finalDisplayName = await handleAppleDisplayName(user);

      // Save user data to Firestore (including phone number without verification)
      await setDoc(doc(db, "users", user.uid), {
        email: userData.email,
        name: finalDisplayName || userData.name,
        phoneNumber: userData.fullPhoneNumber, // Store phone number without verification
        birthday: userData.birthday,
        university: userData.university,
        instagram: userData.instagram,
        tiktok: userData.tiktok,
        hasCompletedOnboarding: true,
        role: "user",
        photoUrl: userData.photo,
      });

      // Track registration completion for AppsFlyer (only for regular users)
      const registrationMethod = isEmailSignup ? "email" : user.providerData[0]?.providerId === "apple.com" ? "apple" : "google";
      trackRegistrationComplete(user.uid, registrationMethod);

      router.replace("/(user-tabs)/home" as any);

      // Reset states
      setShowModal(false);
      setIsEmailSignup(false);
      setUserData({
        email: "",
        name: "",
        phoneNumber: "",
        fullPhoneNumber: "",
        birthday: new Date(),
        university: "",
        password: "",
        confirmPassword: "",
        instagram: "",
        tiktok: "",
        photo: "",
      });
    } catch (error) {
      console.error("[PROFILE COMPLETION ERROR]", error);
      Alert.alert("Error", "Failed to complete profile. Please try again.");
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
              <Text className="text-black text-[35px] font-gBold">Sign In</Text>
            </View>
            <View className="mt-8 gap-y-4">
              <View className="">
                <TextInput
                  placeholder="Enter your email"
                  placeholderTextColor="#888"
                  className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-5 text-base text-black"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={values.email}
                  onChangeText={handleChange("email")}
                  onBlur={handleBlur("email")}
                />
                {errors.email && touched.email && (
                  <Text className="self-start text-red-500 text-sm font-sfregular ">
                    {errors.email}
                  </Text>
                )}
              </View>
              <View>
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor="#888"
                  className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-5 text-base text-black"
                  secureTextEntry
                  value={values.password}
                  onChangeText={handleChange("password")}
                  onBlur={handleBlur("password")}
                />
                {errors.password && touched.password && (
                  <Text className="self-start text-red-500 text-sm font-sfregular ">
                    {errors.password}
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                onPress={() => setShowForgotPasswordModal(true)}
                className="self-end mt-2"
              >
                <Text className="text-[#6476E8] text-sm font-gMedium">
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              className="mt-6 bg-[#6476E8] rounded-xl py-4 items-center"
              onPress={() => handleSubmit()}
            >
              <Text className="text-white font-gBold text-lg">Sign in</Text>
            </TouchableOpacity>
            <View className="mt-6 gap-y-4">
              <TouchableOpacity
                onPress={signInWithApple}
                className="flex-row items-center bg-white border border-[#E5E5E5] rounded-full py-4 px-4 justify-center"
              >
                <Image
                  source={require("@/assets/icons/apple.png")}
                  style={{ width: 24, height: 24, marginRight: 12 }}
                  contentFit="contain"
                />
                <Text className="text-black text-base font-gMedium">
                  Continue with apple
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={signInWithGoogle}
                className="flex-row  items-center bg-white border border-[#E5E5E5] rounded-full py-4 px-4 justify-center"
              >
                <Image
                  source={require("@/assets/icons/google.png")}
                  style={{ width: 24, height: 24, marginRight: 12 }}
                  contentFit="contain"
                />
                <Text className="text-black text-base font-gMedium">
                  Continue with Google
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/admin-login" as any)}
                className="flex-row items-center bg-white border border-[#E5E5E5] rounded-full py-4 px-4 justify-center"
              >
                <Text className="text-black text-base font-gMedium">
                  Admin Login
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View className="items-center pb-6">
            <View className="flex-row items-center">
              <Text className="text-black text-base">
                Don't have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/signup" as any)}>
                <Text className="font-gBold underline">Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showForgotPasswordModal} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-2xl font-gBold text-gray-900 mb-2">
              Reset Password
            </Text>
            <Text className="text-gray-600 text-base mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </Text>
            
            <TextInput
              placeholder="Enter your email"
              placeholderTextColor="#888"
              className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-4 text-base text-black mb-6"
              autoCapitalize="none"
              keyboardType="email-address"
              value={resetEmail}
              onChangeText={setResetEmail}
            />
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-200 rounded-xl py-3 items-center"
                onPress={() => {
                  setShowForgotPasswordModal(false);
                  setResetEmail("");
                }}
                disabled={sendingResetEmail}
              >
                <Text className="text-gray-700 font-gMedium text-base">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className={`flex-1 bg-[#6476E8] rounded-xl py-3 items-center ${
                  sendingResetEmail ? "opacity-60" : ""
                }`}
                onPress={handleForgotPassword}
                disabled={sendingResetEmail}
              >
                {sendingResetEmail ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-gBold text-base">Send Reset Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-[90%]">
              <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                <Text className="text-2xl font-bold text-gray-900">
                  Complete Profile
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    // Sign out user if they close the modal without completing onboarding
                    try {
                      await auth.signOut();
                      console.log("User signed out for incomplete onboarding");
                    } catch (error) {
                      console.error("Error signing out:", error);
                    }
                    setShowModal(false);
                    setCurrentUser(null);
                    setIsEmailSignup(false);
                    setUserData({
                      email: "",
                      name: "",
                      phoneNumber: "",
                      fullPhoneNumber: "",
                      birthday: new Date(),
                      university: "",
                      password: "",
                      confirmPassword: "",
                      instagram: "",
                      tiktok: "",
                      photo: "",
                    });
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 px-6">
                <View className="mt-6 gap-y-4">
                    {isEmailSignup && (
                      <>
                        <View>
                          <Text className="text-gray-600 text-base mb-2">
                            Full Name
                          </Text>
                          <TextInput
                            placeholder="Enter your full name"
                            placeholderTextColor="#888"
                            className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-4 text-base text-black"
                            autoCapitalize="words"
                            value={userData.name}
                            onChangeText={(text) =>
                              setUserData({ ...userData, name: text })
                            }
                          />
                        </View>

                        <View>
                          <Text className="text-gray-600 text-base mb-2">
                            Password
                          </Text>
                          <View className="flex-row items-center bg-white border border-[#E5E5E5] rounded-xl px-4">
                            <TextInput
                              placeholder="Enter your password"
                              placeholderTextColor="#888"
                              className="flex-1 py-4 text-base text-black"
                              secureTextEntry={!showPassword}
                              value={userData.password}
                              onChangeText={(text) =>
                                setUserData({ ...userData, password: text })
                              }
                            />
                            <TouchableOpacity
                              onPress={() => setShowPassword(!showPassword)}
                            >
                              <Ionicons
                                name={
                                  showPassword
                                    ? "eye-outline"
                                    : "eye-off-outline"
                                }
                                size={22}
                                color="#888"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View>
                          <Text className="text-gray-600 text-base mb-2">
                            Confirm Password
                          </Text>
                          <View className="flex-row items-center bg-white border border-[#E5E5E5] rounded-xl px-4">
                            <TextInput
                              placeholder="Confirm your password"
                              placeholderTextColor="#888"
                              className="flex-1 py-4 text-base text-black"
                              secureTextEntry={!showConfirmPassword}
                              value={userData.confirmPassword}
                              onChangeText={(text) =>
                                setUserData({
                                  ...userData,
                                  confirmPassword: text,
                                })
                              }
                            />
                            <TouchableOpacity
                              onPress={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                            >
                              <Ionicons
                                name={
                                  showConfirmPassword
                                    ? "eye-outline"
                                    : "eye-off-outline"
                                }
                                size={22}
                                color="#888"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </>
                    )}

                    <View>
                      <Text className="text-gray-600 text-base mb-2">
                        Phone Number
                      </Text>
                      <PhoneInput
                        defaultCountry="US"
                        value={userData.phoneNumber}
                        onChangePhoneNumber={(phoneNumber) => {
                          // Create full phone number with country code and no spaces
                          const fullPhoneNumber = selectedCountry
                            ? `${
                                selectedCountry.callingCode
                              }${phoneNumber.replace(/\s/g, "")}`
                            : phoneNumber;

                          setUserData({
                            ...userData,
                            phoneNumber,
                            fullPhoneNumber,
                          });
                        }}
                        selectedCountry={selectedCountry}
                        onChangeSelectedCountry={(country) => {
                          setSelectedCountry(country);
                          // Update full phone number when country changes
                          if (userData.phoneNumber && country) {
                            const fullPhoneNumber = `${
                              country.callingCode
                            }${userData.phoneNumber.replace(/\s/g, "")}`;
                            setUserData({
                              ...userData,
                              fullPhoneNumber,
                            });
                          }
                        }}
                        placeholder="Your phone"
                      />
                    </View>

                    <View>
                      <Text className="text-gray-600 text-base mb-2">
                        Select Birthday
                      </Text>
                      <TouchableOpacity
                        className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-4 flex-row items-center justify-between"
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text className="text-base text-gray-900">
                          {formatDate(userData.birthday)}
                        </Text>
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                    </View>
                    <DatePicker
                      modal
                      mode="date"
                      open={showDatePicker}
                      date={birthdayDate}
                      onConfirm={(date) => {
                        setShowDatePicker(false);
                        setBirthdayDate(date);
                        setUserData({ ...userData, birthday: date });
                      }}
                      onCancel={() => {
                        setShowDatePicker(false);
                      }}
                    />

                    <View>
                      <Text className="text-gray-600 text-base mb-2">
                        University
                      </Text>
                      <View className="relative">
                        <TextInput
                          placeholder="Enter your university name"
                          placeholderTextColor="#888"
                          className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-4 text-base text-black"
                          value={userData.university}
                          onChangeText={handleUniversityChange}
                          onBlur={() => {
                            // Clear any existing timeout
                            if (hideTimeout) {
                              clearTimeout(hideTimeout);
                            }
                            // Longer delay for physical devices
                            const timeout = setTimeout(hideSuggestions, 500);
                            setHideTimeout(timeout);
                          }}
                        />
                        {showSuggestions && (
                          <View
                            className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E5E5] rounded-xl shadow-lg"
                            style={{
                              zIndex: 9999,
                              elevation: 15, // Increased elevation for Android
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.1,
                              shadowRadius: 3,
                              maxHeight: 120,
                            }}
                          >
                            <ScrollView
                              showsVerticalScrollIndicator={false}
                              nestedScrollEnabled={true}
                              style={{ maxHeight: 120 }}
                              keyboardShouldPersistTaps="handled"
                            >
                              {universitySuggestions
                                .slice(0, 3)
                                .map((item, index) => (
                                  <TouchableOpacity
                                    key={`${item}-${index}`}
                                    className="px-4 py-3 border-b border-gray-100 last:border-b-0"
                                    onPress={() => selectUniversity(item)}
                                    activeOpacity={0.7}
                                    delayPressIn={0}
                                    onPressIn={() => {
                                      // Immediately select on press start to prevent blur interference
                                      selectUniversity(item);
                                    }}
                                  >
                                    <Text className="text-base text-black">
                                      {item}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    </View>

                    <View>
                      <Text className="text-gray-600 text-base mb-2">
                        Instagram Handle
                      </Text>

                      <View className="flex-row items-center bg-white border border-[#E5E5E5] rounded-xl px-4">
                        <Image
                          source={require("@/assets/icons/instagram.png")}
                          style={{ width: 24, height: 24, marginRight: 10 }}
                        />
                        <TextInput
                          placeholder="@yourinstagram"
                          placeholderTextColor="#888"
                          value={userData.instagram}
                          onChangeText={(text) =>
                            setUserData({ ...userData, instagram: text })
                          }
                          className="flex-1 py-5 text-base text-black"
                        />
                      </View>
                    </View>

                    <View>
                      <Text className="text-gray-600 text-base mb-2">
                        TikTok Handle
                      </Text>
                      <View className="flex-row items-center bg-white border border-[#E5E5E5] rounded-xl px-4">
                        <Image
                          source={require("@/assets/icons/tiktok.png")}
                          style={{ width: 24, height: 24, marginRight: 10 }}
                        />
                        <TextInput
                          placeholder="@yourtiktok"
                          placeholderTextColor="#888"
                          value={userData.tiktok}
                          onChangeText={(text) =>
                            setUserData({ ...userData, tiktok: text })
                          }
                          className="flex-1 py-5 text-base text-black"
                        />
                      </View>
                    </View>
                </View>
              </ScrollView>

              <View className="p-6 border-t border-gray-100">
                <TouchableOpacity
                  className="bg-[#6476E8] rounded-xl py-4 items-center"
                  onPress={handleCompleteProfile}
                >
                  <Text className="text-white font-gBold text-lg">
                    Continue
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default signin;
