import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import React, { useRef, useState } from "react";
import CsccBlackLogoSmallSvg from "@/assets/svgs/CccBlackLogoSmall";
import { Ionicons } from "@expo/vector-icons";
import {
  getAuth,
  createUserWithEmailAndPassword,
} from "@react-native-firebase/auth";
import { getFirestore, doc, setDoc } from "@react-native-firebase/firestore";
import { router } from "expo-router";
import DatePicker from "react-native-date-picker";
import collegeData from "@/data/college-data.json";
import PhoneInput, { ICountry } from "react-native-international-phone-number";
import { trackRegistrationComplete } from "@/utils/appsFlyerEvents";

const Signup = () => {
  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [universitySuggestions, setUniversitySuggestions] = useState<string[]>(
    []
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<null | ICountry>(null);
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    fullPhoneNumber: "",
    birthday: new Date(),
    university: "",
    password: "",
    confirmPassword: "",
    instagram: "",
    tiktok: "",
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

  // Animate progress bar
  React.useEffect(() => {
    Animated.timing(progress, {
      toValue: step,
      duration: 400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [step]);

  // Progress bar width (2 steps)
  const progressInterpolate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["50%", "100%"],
  });


  const handleCreateAccount = async () => {
    try {
      if (userData.password !== userData.confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );

      if (userCredential.user) {
        // Save user data to Firestore (including phone number without verification)
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: userData.name,
          email: userData.email,
          phoneNumber: userData.fullPhoneNumber, // Store phone number without verification
          birthday: userData.birthday,
          university: userData.university,
          instagram: userData.instagram,
          tiktok: userData.tiktok,
          hasCompletedOnboarding: true,
          role: "user",
        });

        // Track registration completion for AppsFlyer (only for regular users)
        trackRegistrationComplete(userCredential.user.uid, "email");

        router.replace("/(user-tabs)/home" as any);
      }
    } catch (error: any) {
      console.error("[SIGNUP ERROR]", error);
      Alert.alert("Error", error.message || "Failed to create account");
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
          onScrollBeginDrag={hideSuggestions}
        >
          <View className="flex-1 px-6 pt-6">
            <View className="flex-row items-center w-full mb-2">
              <CsccBlackLogoSmallSvg />
              <View className="flex-1 ml-4">
                <View className="h-2 w-full bg-[#E5E5E5] rounded-full overflow-hidden">
                  <Animated.View
                    style={{
                      width: progressInterpolate,
                      height: "100%",
                      backgroundColor: "#6476E8",
                      borderRadius: 999,
                      position: "absolute",
                      left: 0,
                      top: 0,
                    }}
                  />
                </View>
              </View>
            </View>
            <View style={{ flex: 1, position: "relative" }}>
              {step === 0 && (
                <>
                  <Text className="text-black text-[28px] font-gBold mt-8 mb-6">
                    Get Started — Sign Up
                  </Text>
                  <View className="gap-y-4" style={{ overflow: "visible" }}>
                    <TextInput
                      placeholder="Your full name"
                      placeholderTextColor="#888"
                      className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-5 text-base text-black"
                      autoCapitalize="words"
                      value={userData.name}
                      onChangeText={(text) =>
                        setUserData({ ...userData, name: text })
                      }
                    />
                    <TextInput
                      placeholder="Your email"
                      placeholderTextColor="#888"
                      className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-5 text-base text-black"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={userData.email}
                      onChangeText={(text) =>
                        setUserData({ ...userData, email: text })
                      }
                    />
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
                    <TouchableOpacity
                      className="flex-row items-center bg-white border border-[#E5E5E5] rounded-xl px-4"
                      onPress={() => setShowDatePicker(true)}
                    >
                      <TextInput
                        placeholder="Select birthday"
                        placeholderTextColor="#888"
                        className="flex-1 py-5 text-base text-black"
                        editable={false}
                        value={userData.birthday.toLocaleDateString()}
                      />
                      <Ionicons
                        name="calendar-outline"
                        size={22}
                        color="#888"
                      />
                    </TouchableOpacity>
                    <View className="relative">
                      <TextInput
                        placeholder="Your university name"
                        placeholderTextColor="#888"
                        className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-5 text-base text-black"
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
                    <View className="flex-row items-center bg-white border border-[#E5E5E5] rounded-xl px-4">
                      <TextInput
                        placeholder="Password"
                        placeholderTextColor="#888"
                        className="flex-1 py-5 text-base text-black"
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
                            showPassword ? "eye-outline" : "eye-off-outline"
                          }
                          size={22}
                          color="#888"
                        />
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row items-center bg-white border border-[#E5E5E5] rounded-xl px-4">
                      <TextInput
                        placeholder="Confirm password"
                        placeholderTextColor="#888"
                        className="flex-1 py-5 text-base text-black"
                        secureTextEntry={!showConfirmPassword}
                        value={userData.confirmPassword}
                        onChangeText={(text) =>
                          setUserData({ ...userData, confirmPassword: text })
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
                  <TouchableOpacity
                    className="mt-8 bg-[#6476E8] rounded-xl py-4 items-center"
                    onPress={() => {
                      console.log(userData);
                      setStep(1);
                    }}
                  >
                    <Text className="text-white font-gBold text-lg">Next</Text>
                  </TouchableOpacity>

                  <DatePicker
                    modal
                    mode="date"
                    open={showDatePicker}
                    date={userData.birthday}
                    onConfirm={(date) => {
                      setShowDatePicker(false);
                      setUserData({ ...userData, birthday: date });
                    }}
                    onCancel={() => {
                      setShowDatePicker(false);
                    }}
                  />
                </>
              )}
              {step === 1 && (
                <>
                  <TouchableOpacity className="my-4" onPress={() => setStep(0)}>
                    <Ionicons name="arrow-back" size={28} color="#222" />
                  </TouchableOpacity>
                  <Text className="text-black text-[28px] font-gBold mt-4 mb-6">
                    Add your socials
                  </Text>
                  <View className="gap-y-4">
                    <View className="flex-row items-center bg-white border border-[#E5E5E5] rounded-xl px-4">
                      <Image
                        source={require("@/assets/icons/tiktok.png")}
                        style={{ width: 24, height: 24, marginRight: 10 }}
                      />
                      <TextInput
                        placeholder="@yourtiktok"
                        placeholderTextColor="#888"
                        className="flex-1 py-5 text-base text-black"
                        value={userData.tiktok}
                        onChangeText={(text) =>
                          setUserData({ ...userData, tiktok: text })
                        }
                      />
                    </View>
                    <View className="flex-row items-center bg-white border border-[#E5E5E5] rounded-xl px-4">
                      <Image
                        source={require("@/assets/icons/instagram.png")}
                        style={{ width: 24, height: 24, marginRight: 10 }}
                      />
                      <TextInput
                        placeholder="@yourinstagram"
                        placeholderTextColor="#888"
                        className="flex-1 py-5 text-base text-black"
                        value={userData.instagram}
                        onChangeText={(text) =>
                          setUserData({ ...userData, instagram: text })
                        }
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    className="mt-8 bg-[#6476E8] rounded-xl py-4 items-center"
                    onPress={handleCreateAccount}
                  >
                    <Text className="text-white font-gBold text-lg">
                      Create account
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Signup;
