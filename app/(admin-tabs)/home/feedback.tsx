import {
  View,
  Text,
  
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "@react-native-firebase/firestore";

interface Feedback {
  id: string;
  title: string;
  description: string;
  userId: string;
  userEmail: string;
  userName: string;
  types: string[];
  createdAt: any;
  status: "pending" | "reviewed" | "resolved";
}

const feedback = () => {
  const db = getFirestore();

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const feedbackList: Feedback[] = [];
      querySnapshot.forEach((doc) => {
        feedbackList.push({
          id: doc.id,
          ...doc.data(),
        } as Feedback);
      });
      setFeedbacks(feedbackList);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return { bg: "bg-yellow-100", text: "text-yellow-700", icon: "time" };
      case "reviewed":
        return { bg: "bg-blue-100", text: "text-blue-700", icon: "eye" };
      case "resolved":
        return {
          bg: "bg-green-100",
          text: "text-green-700",
          icon: "checkmark-circle",
        };
      default:
        return { bg: "bg-gray-100", text: "text-gray-700", icon: "help" };
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Bug Report":
        return { bg: "bg-red-100", text: "text-red-700", icon: "bug" };
      case "Feature Request":
        return { bg: "bg-amber-100", text: "text-amber-700", icon: "bulb" };
      case "General Feedback":
        return {
          bg: "bg-emerald-100",
          text: "text-emerald-700",
          icon: "thumbs-up",
        };
      case "Help & Support":
        return {
          bg: "bg-indigo-100",
          text: "text-indigo-700",
          icon: "help-circle",
        };
      default:
        return { bg: "bg-gray-100", text: "text-gray-700", icon: "help" };
    }
  };

  const updateFeedbackStatus = async (
    feedbackId: string,
    newStatus: string
  ) => {
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, "feedback", feedbackId), {
        status: newStatus,
      });
      setModalVisible(false);
      setSelectedFeedback(null);
    } catch (error) {
      console.error("Error updating feedback status:", error);
      Alert.alert("Error", "Failed to update feedback status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const deleteFeedback = async (feedbackId: string) => {
    Alert.alert(
      "Delete Feedback",
      "Are you sure you want to delete this feedback? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "feedback", feedbackId));
              setModalVisible(false);
              setSelectedFeedback(null);
            } catch (error) {
              console.error("Error deleting feedback:", error);
              Alert.alert("Error", "Failed to delete feedback.");
            }
          },
        },
      ]
    );
  };

  const openFeedbackModal = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setModalVisible(true);
  };

  const renderFeedbackItem = ({ item }: { item: Feedback }) => {
    const statusStyle = getStatusColor(item.status);

    return (
      <TouchableOpacity
        onPress={() => openFeedbackModal(item)}
        className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
        activeOpacity={0.7}
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3">
            <Text
              className="font-gBold text-lg text-gray-900 mb-1"
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text className="text-gray-600 text-sm" numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          <View
            className={`${statusStyle.bg} rounded-lg px-2 py-1 flex-row items-center`}
          >
            <Ionicons
              name={statusStyle.icon as any}
              size={12}
              color={statusStyle.text.replace("text-", "#")}
            />
            <Text
              className={`${statusStyle.text} text-xs font-gMedium ml-1 capitalize`}
            >
              {item.status}
            </Text>
          </View>
        </View>

        {/* Type badges */}
        {item.types && item.types.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mt-2">
            {item.types.map((type, index) => {
              const typeStyle = getTypeColor(type);
              return (
                <View
                  key={index}
                  className={`${typeStyle.bg} rounded-md px-2 py-1 flex-row items-center`}
                >
                  <Ionicons
                    name={typeStyle.icon as any}
                    size={10}
                    color={typeStyle.text.replace("text-", "#")}
                  />
                  <Text
                    className={`${typeStyle.text} text-xs font-gMedium ml-1`}
                  >
                    {type}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <View className="flex-row items-center">
            <Ionicons name="person-circle" size={16} color="#6B7280" />
            <Text className="text-gray-500 text-sm ml-1 font-gMedium">
              {item.userName}
            </Text>
          </View>
          <Text className="text-gray-400 text-xs">
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const getStatusCounts = () => {
    const pending = feedbacks.filter((f) => f.status === "pending").length;
    const reviewed = feedbacks.filter((f) => f.status === "reviewed").length;
    const resolved = feedbacks.filter((f) => f.status === "resolved").length;
    return { pending, reviewed, resolved };
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#6476E8" />
        <Text className="text-gray-500 mt-2">Loading feedback...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-6 bg-white">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="font-gBold text-xl text-gray-900">User Feedback</Text>
        <View className="w-10" />
      </View>

      {/* Stats Cards */}
      <View className="px-4 mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            <View className="bg-yellow-100 rounded-xl p-4 min-w-[120px]">
              <Text className="text-yellow-700 font-gBold text-2xl">
                {statusCounts.pending}
              </Text>
              <Text className="text-yellow-600 text-sm font-gMedium">
                Pending
              </Text>
            </View>
            <View className="bg-blue-100 rounded-xl p-4 min-w-[120px]">
              <Text className="text-blue-700 font-gBold text-2xl">
                {statusCounts.reviewed}
              </Text>
              <Text className="text-blue-600 text-sm font-gMedium">
                Reviewed
              </Text>
            </View>
            <View className="bg-green-100 rounded-xl p-4 min-w-[120px]">
              <Text className="text-green-700 font-gBold text-2xl">
                {statusCounts.resolved}
              </Text>
              <Text className="text-green-600 text-sm font-gMedium">
                Resolved
              </Text>
            </View>
            <View className="bg-gray-100 rounded-xl p-4 min-w-[120px]">
              <Text className="text-gray-700 font-gBold text-2xl">
                {feedbacks.length}
              </Text>
              <Text className="text-gray-600 text-sm font-gMedium">Total</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Feedback List */}
      <View className="flex-1 px-4">
        {feedbacks.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Ionicons name="chatbubbles-outline" size={64} color="#9CA3AF" />
            <Text className="text-gray-500 text-lg font-gBold mt-4">
              No Feedback Yet
            </Text>
            <Text className="text-gray-400 text-center mt-2">
              User feedback will appear here when submitted.
            </Text>
          </View>
        ) : (
          <FlatList
            data={feedbacks}
            renderItem={renderFeedbackItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>

      {/* Feedback Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView edges={["top"]} className="flex-1 bg-white">
          {selectedFeedback && (
            <>
              {/* Modal Header */}
              <View className="flex-row items-center justify-between px-4 pt-4 pb-6 border-b border-gray-100">
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="font-gBold text-lg text-gray-900">
                  Feedback Details
                </Text>
                <TouchableOpacity
                  onPress={() => deleteFeedback(selectedFeedback.id)}
                  className="w-10 h-10 rounded-full bg-red-100 items-center justify-center"
                >
                  <Ionicons name="trash" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 px-4 py-6">
                {/* Status */}
                <View className="mb-6">
                  <Text className="text-gray-700 font-gBold text-base mb-2">
                    Status
                  </Text>
                  <View className="flex-row gap-2">
                    {["pending", "reviewed", "resolved"].map((status) => (
                      <TouchableOpacity
                        key={status}
                        onPress={() =>
                          updateFeedbackStatus(selectedFeedback.id, status)
                        }
                        disabled={updatingStatus}
                        className={`flex-1 py-3 rounded-xl items-center ${
                          selectedFeedback.status === status
                            ? getStatusColor(status).bg
                            : "bg-gray-100"
                        }`}
                      >
                        <Text
                          className={`font-gMedium text-sm capitalize ${
                            selectedFeedback.status === status
                              ? getStatusColor(status).text
                              : "text-gray-500"
                          }`}
                        >
                          {status}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Title */}
                <View className="mb-4">
                  <Text className="text-gray-700 font-gBold text-base mb-2">
                    Title
                  </Text>
                  <Text className="text-gray-900 text-lg font-gMedium">
                    {selectedFeedback.title}
                  </Text>
                </View>

                {/* Description */}
                <View className="mb-6">
                  <Text className="text-gray-700 font-gBold text-base mb-2">
                    Description
                  </Text>
                  <View className="bg-gray-50 rounded-xl p-4">
                    <Text className="text-gray-800 leading-6">
                      {selectedFeedback.description}
                    </Text>
                  </View>
                </View>

                {/* Types */}
                {selectedFeedback.types &&
                  selectedFeedback.types.length > 0 && (
                    <View className="mb-6">
                      <Text className="text-gray-700 font-gBold text-base mb-2">
                        Feedback Types
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {selectedFeedback.types.map((type, index) => {
                          const typeStyle = getTypeColor(type);
                          return (
                            <View
                              key={index}
                              className={`${typeStyle.bg} rounded-lg px-3 py-2 flex-row items-center`}
                            >
                              <Ionicons
                                name={typeStyle.icon as any}
                                size={16}
                                color={typeStyle.text.replace("text-", "#")}
                              />
                              <Text
                                className={`${typeStyle.text} text-sm font-gMedium ml-2`}
                              >
                                {type}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                {/* User Info */}
                <View className="mb-6">
                  <Text className="text-gray-700 font-gBold text-base mb-2">
                    User Information
                  </Text>
                  <View className="bg-gray-50 rounded-xl p-4">
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="person" size={16} color="#6B7280" />
                      <Text className="text-gray-700 ml-2 font-gMedium">
                        {selectedFeedback.userName}
                      </Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="mail" size={16} color="#6B7280" />
                      <Text className="text-gray-700 ml-2">
                        {selectedFeedback.userEmail}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="time" size={16} color="#6B7280" />
                      <Text className="text-gray-700 ml-2">
                        {formatDate(selectedFeedback.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {updatingStatus && (
                <View className="absolute inset-0 bg-black/20 justify-center items-center">
                  <View className="bg-white rounded-xl p-6 items-center">
                    <ActivityIndicator size="large" color="#6476E8" />
                    <Text className="text-gray-700 mt-2">
                      Updating status...
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default feedback;
