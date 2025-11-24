import {
  View,
  Text,
  
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getAuth } from "@react-native-firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "@react-native-firebase/firestore";

const feedback = () => {
  const auth = getAuth();
  const db = getFirestore();
  const currentUser = auth.currentUser;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState("Anonymous");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Fetch user name from Firestore
  useEffect(() => {
    const fetchUserName = async () => {
      if (!currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserName(userData?.name || "Anonymous");
        }
      } catch (error) {
        console.error("Error fetching user name:", error);
        setUserName("Anonymous");
      }
    };

    fetchUserName();
  }, [currentUser]);

  const toggleFeedbackType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmitFeedback = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert(
        "Missing Information",
        "Please fill in both title and description."
      );
      return;
    }

    if (!currentUser) {
      Alert.alert("Error", "You must be signed in to submit feedback.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        title: title.trim(),
        description: description.trim(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: userName,
        types: selectedTypes,
        createdAt: serverTimestamp(),
        status: "pending", // pending, reviewed, resolved
      });

      Alert.alert(
        "Feedback Submitted",
        "Thank you for your feedback! We'll review it and get back to you if needed.",
        [
          {
            text: "OK",
            onPress: () => {
              setTitle("");
              setDescription("");
              setSelectedTypes([]);
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error submitting feedback:", error);
      Alert.alert("Error", "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="font-gBold text-xl text-gray-900">
            Send Feedback
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Info */}
          <View className="mb-6">
            <View className="bg-blue-50 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name="information-circle" size={20} color="#3B82F6" />
                <Text className="text-blue-600 font-gBold text-base ml-2">
                  We Value Your Feedback
                </Text>
              </View>
              <Text className="text-blue-600 text-sm leading-5">
                Help us improve the app by reporting bugs, suggesting features,
                or sharing your experience.
              </Text>
            </View>
          </View>

          {/* Feedback Form */}
          <View className="mb-6">
            {/* Title Field */}
            <View className="mb-4">
              <Text className="text-gray-700 font-gBold text-base mb-2">
                Title <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Brief summary of your feedback"
                placeholderTextColor="#9CA3AF"
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-gMedium"
                maxLength={100}
                editable={!submitting}
              />
              <Text className="text-gray-400 text-xs mt-1 text-right">
                {title.length}/100
              </Text>
            </View>

            {/* Description Field */}
            <View className="mb-6">
              <Text className="text-gray-700 font-gBold text-base mb-2">
                Description <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Please provide detailed information about your feedback, including steps to reproduce if it's a bug report."
                placeholderTextColor="#9CA3AF"
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-gMedium"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={1000}
                editable={!submitting}
                style={{ minHeight: 120 }}
              />
              <Text className="text-gray-400 text-xs mt-1 text-right">
                {description.length}/1000
              </Text>
            </View>

            {/* Feedback Types */}
            <View className="mb-6">
              <Text className="text-gray-700 font-gBold text-base mb-3">
                Feedback Types (Optional)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { icon: "bug", label: "Bug Report", color: "#EF4444" },
                  { icon: "bulb", label: "Feature Request", color: "#F59E0B" },
                  {
                    icon: "thumbs-up",
                    label: "General Feedback",
                    color: "#10B981",
                  },
                  {
                    icon: "help-circle",
                    label: "Help & Support",
                    color: "#6366F1",
                  },
                ].map((type, index) => {
                  const isSelected = selectedTypes.includes(type.label);
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => toggleFeedbackType(type.label)}
                      disabled={submitting}
                      className={`rounded-lg px-3 py-2 flex-row items-center border ${
                        isSelected
                          ? "bg-blue-50 border-blue-200"
                          : "bg-gray-100 border-gray-200"
                      }`}
                    >
                      <Ionicons
                        name={type.icon as any}
                        size={16}
                        color={isSelected ? "#3B82F6" : type.color}
                      />
                      <Text
                        className={`text-sm font-gMedium ml-2 ${
                          isSelected ? "text-blue-600" : "text-gray-600"
                        }`}
                      >
                        {type.label}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="#3B82F6"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View className="px-6 pb-6 pt-4 border-t border-gray-100">
          <TouchableOpacity
            onPress={handleSubmitFeedback}
            disabled={submitting || !title.trim() || !description.trim()}
            className={`rounded-xl py-4 items-center ${
              submitting || !title.trim() || !description.trim()
                ? "bg-gray-300"
                : "bg-blue-500"
            }`}
          >
            {submitting ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-white font-gBold text-base ml-2">
                  Submitting...
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="send" size={20} color="white" />
                <Text className="text-white font-gBold text-base ml-2">
                  Submit Feedback
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default feedback;
