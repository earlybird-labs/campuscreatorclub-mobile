/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

/* eslint-disable indent, max-len, object-curly-spacing */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  onDocumentCreated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

/**
 * This function runs once every 2 days.
 * It looks for deleted users older than 30 days,
 * removes their auth accounts and their documents.
 */
exports.cleanupDeletedUsers = onSchedule("every 72 hours", async (event) => {
  const now = admin.firestore.Timestamp.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(now.toMillis() - THIRTY_DAYS_MS);

  console.log(`Starting cleanup; threshold: ${cutoffDate}`);

  try {
    const snapshot = await db.collection("deleted_users").get();

    const batch = db.batch();
    const usersToDelete = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const deletedAt = data.deletedAt ? data.deletedAt.toDate() : null;

      if (deletedAt && deletedAt <= cutoffDate) {
        // Mark for deletion
        batch.delete(doc.ref);
        if (data.uid) {
          usersToDelete.push(data.uid);
        }
      }
    });

    // Delete documents in Firestore
    await batch.commit();
    console.log(`Deleted ${usersToDelete.length} documents.`);

    // Delete users from Firebase Authentication
    for (const uid of usersToDelete) {
      try {
        await admin.auth().deleteUser(uid);
        console.log(`Successfully deleted auth user: ${uid}`);
      } catch (error) {
        console.error(`Error deleting user ${uid}:`, error);
      }
    }

    console.log("Cleanup finished successfully.");
  } catch (error) {
    console.error("Error running cleanup:", error);
  }

  return null;
});

/**
 * Cloud Function for @everyone notifications
 * Handles notifications for all chat types (global, campaign, subchat)
 */
exports.sendEveryoneNotifications = onCall(async (request) => {
  // 1. AUTHENTICATION CHECK
  if (!request.auth) {
    throw new Error("User must be authenticated to send notifications.");
  }

  // 2. EXTRACT AND VALIDATE PARAMETERS
  const {
    messageText,
    chatType, // "global", "campaign", or "subchat"
    chatId, // campaignId or subChatId (null for global)
    messageId, // The ID of the message that contains @everyone
  } = request.data;

  if (!messageText || !chatType) {
    throw new Error("Missing required parameters: messageText and chatType.");
  }

  // For campaign/subchat, chatId is required
  if ((chatType === "campaign" || chatType === "subchat") && !chatId) {
    throw new Error(`chatId is required for ${chatType} chat type.`);
  }

  const userId = request.auth.uid;

  try {
    // 3. VERIFY USER IS ADMIN
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new Error("User not found.");
    }

    const userData = userDoc.data();
    const isAdmin = userData.isAdmin || userData.role === "admin";

    if (!isAdmin) {
      throw new Error("Only admins can send @everyone notifications.");
    }

    // 4. GET SENDER NAME
    const senderName = userData.name || userData.displayName || "Admin";

    // 5. GET TARGET USERS BASED ON CHAT TYPE
    let targetUsers = [];

    switch (chatType) {
      case "global":
        // Get all users with expo push tokens (except sender)
        const allUsersSnapshot = await db
          .collection("users")
          .where("expoPushToken", "!=", null)
          .get();

        targetUsers = allUsersSnapshot.docs
          .filter((doc) => doc.id !== userId)
          .map((doc) => ({
            id: doc.id,
            expoPushToken: doc.data().expoPushToken,
            name: doc.data().name,
          }))
          .filter((user) => user.expoPushToken);
        break;

      case "campaign":
        // Get campaign and approved users
        const campaignDoc = await db.collection("campaigns").doc(chatId).get();

        if (!campaignDoc.exists) {
          throw new Error("Campaign not found.");
        }

        const approvedUserIds = campaignDoc.data().approved || [];

        // Fetch user data for approved users
        if (approvedUserIds.length > 0) {
          const userPromises = approvedUserIds
            .filter((id) => id !== userId)
            .map((id) => db.collection("users").doc(id).get());

          const userDocs = await Promise.all(userPromises);
          targetUsers = userDocs
            .filter((doc) => doc.exists && doc.data().expoPushToken)
            .map((doc) => ({
              id: doc.id,
              expoPushToken: doc.data().expoPushToken,
              name: doc.data().name,
            }));
        }
        break;

      case "subchat":
        // Get subchat and member users
        const subChatDoc = await db.collection("subChats").doc(chatId).get();

        if (!subChatDoc.exists) {
          throw new Error("Subchat not found.");
        }

        const memberIds = subChatDoc.data().members || [];

        // Fetch user data for members
        if (memberIds.length > 0) {
          const userPromises = memberIds
            .filter((id) => id !== userId)
            .map((id) => db.collection("users").doc(id).get());

          const userDocs = await Promise.all(userPromises);
          targetUsers = userDocs
            .filter((doc) => doc.exists && doc.data().expoPushToken)
            .map((doc) => ({
              id: doc.id,
              expoPushToken: doc.data().expoPushToken,
              name: doc.data().name,
            }));
        }
        break;

      default:
        throw new Error("Invalid chat type.");
    }

    // 6. CHECK IF THERE ARE USERS TO NOTIFY
    if (targetUsers.length === 0) {
      return {
        success: true,
        message: "No users to notify",
        notificationsSent: 0,
      };
    }

    // 7. PREPARE NOTIFICATION CONTENT
    const lines = messageText.split("\n");
    const shortMessage =
      lines.length > 1 ? lines.slice(0, 2).join("\n") : lines[0];
    const notificationBody =
      shortMessage.length > 100
        ? `${shortMessage.substring(0, 100)}...`
        : shortMessage;

    // 8. CREATE PROGRESS TRACKING DOCUMENT
    const progressRef = db.collection("notificationProgress").doc();
    await progressRef.set({
      type: "everyone",
      chatType: chatType,
      chatId: chatId || null,
      messageId: messageId || null,
      senderId: userId,
      senderName: senderName,
      totalUsers: targetUsers.length,
      sentCount: 0,
      failedCount: 0,
      status: "processing",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 9. SEND NOTIFICATIONS IN BATCHES
    const BATCH_SIZE = 100; // Expo's recommended batch size
    const tokens = targetUsers.map((user) => user.expoPushToken);
    let successCount = 0;
    let failCount = 0;
    const failedTokens = [];

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);

      // Update progress
      await progressRef.update({
        sentCount: i,
        status: `Sending batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          tokens.length / BATCH_SIZE
        )}`,
      });

      // Prepare notifications for this batch
      const notifications = batch.map((token) => ({
        to: token,
        sound: "default",
        title: `📢 ${senderName} to everyone`,
        body: notificationBody,
        data: {
          type: "everyone",
          chatType: chatType,
          chatId: chatId || "",
          messageId: messageId || "",
          senderId: userId,
          senderName: senderName,
        },
        priority: "high",
        channelId: "default", // For Android
      }));

      // Send batch to Expo
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(notifications),
        });

        if (response.ok) {
          const result = await response.json();

          // Check individual ticket statuses
          if (result.data) {
            result.data.forEach((ticket, index) => {
              if (ticket.status === "ok") {
                successCount++;
              } else {
                failCount++;
                failedTokens.push(batch[index]);
                console.error(
                  `Notification failed for token: ${batch[index]}`,
                  ticket
                );
              }
            });
          } else {
            successCount += batch.length;
          }
        } else {
          failCount += batch.length;
          failedTokens.push(...batch);
          console.error("Batch failed:", await response.text());
        }
      } catch (error) {
        failCount += batch.length;
        failedTokens.push(...batch);
        console.error("Error sending notification batch:", error);
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < tokens.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // 10. UPDATE FINAL PROGRESS
    await progressRef.update({
      sentCount: successCount,
      failedCount: failCount,
      failedTokens: failedTokens.slice(0, 10), // Store first 10 failed tokens for debugging
      status: "completed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 11. LOG ANALYTICS EVENT
    await db.collection("notificationAnalytics").add({
      type: "everyone",
      chatType: chatType,
      chatId: chatId || null,
      senderId: userId,
      senderName: senderName,
      totalTargets: targetUsers.length,
      successCount: successCount,
      failCount: failCount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 12. RETURN RESULT
    return {
      success: true,
      message: `Notifications sent successfully`,
      notificationsSent: successCount,
      notificationsFailed: failCount,
      totalUsers: targetUsers.length,
      progressId: progressRef.id,
    };
  } catch (error) {
    console.error("Error in sendEveryoneNotifications:", error);

    // Log error for debugging
    await db.collection("notificationErrors").add({
      type: "everyone",
      chatType: chatType,
      chatId: chatId || null,
      userId: userId,
      error: error.message,
      stack: error.stack,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw new Error("Failed to send notifications: " + error.message);
  }
});

/**
 * Cloud Function to send notifications when an announcement is created
 * Triggers on announcement creation and sends batch notifications to all users
 */
exports.sendAnnouncementNotifications = onDocumentCreated(
  "announcements/{announcementId}",
  async (event) => {
    const announcementData = event.data.data();
    const announcementId = event.params.announcementId;

    console.log(
      `New announcement created: ${announcementId}`,
      announcementData
    );

    try {
      // Get all users with Expo push tokens
      const usersSnapshot = await db
        .collection("users")
        .where("expoPushToken", "!=", null)
        .get();

      const expoPushTokens = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.expoPushToken) {
          expoPushTokens.push(userData.expoPushToken);
        }
      });

      console.log(`Found ${expoPushTokens.length} users with push tokens`);

      if (expoPushTokens.length === 0) {
        console.log("No users with push tokens found");
        return null;
      }

      // Prepare notification content
      const notificationTitle = "📢 New Announcement";
      const notificationBody = `Check out "${announcementData.title}"`;

      // Prepare messages for Expo
      const messages = expoPushTokens.map((token) => ({
        to: token,
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: "announcement",
          id: announcementId,
          title: announcementData.title,
        },
        sound: "default",
        priority: "high",
        channelId: "default", // For Android
      }));

      // Send in batches of 100 (Expo's limit)
      const batchSize = 100;
      let totalSent = 0;
      let totalFailed = 0;

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);

        try {
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(batch),
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`Batch ${Math.floor(i / batchSize) + 1} sent:`, result);
            totalSent += batch.length;
          } else {
            console.error(
              `Batch ${Math.floor(i / batchSize) + 1} failed:`,
              await response.text()
            );
            totalFailed += batch.length;
          }
        } catch (error) {
          console.error(
            `Error sending batch ${Math.floor(i / batchSize) + 1}:`,
            error
          );
          totalFailed += batch.length;
        }

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < messages.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      console.log(
        `Announcement notifications sent: ${totalSent} successful, ${totalFailed} failed`
      );
      return null;
    } catch (error) {
      console.error("Error sending announcement notifications:", error);
      throw error;
    }
  }
);

/**
 * Cloud Function to send notifications when a campaign is created
 * Triggers on campaign creation and sends batch notifications to all users
 */
exports.sendCampaignNotifications = onDocumentCreated(
  "campaigns/{campaignId}",
  async (event) => {
    const campaignData = event.data.data();
    const campaignId = event.params.campaignId;

    console.log(`New campaign created: ${campaignId}`, campaignData);

    try {
      // Get all users with Expo push tokens
      const usersSnapshot = await db
        .collection("users")
        .where("expoPushToken", "!=", null)
        .get();

      const expoPushTokens = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.expoPushToken) {
          expoPushTokens.push(userData.expoPushToken);
        }
      });

      console.log(`Found ${expoPushTokens.length} users with push tokens`);

      if (expoPushTokens.length === 0) {
        console.log("No users with push tokens found");
        return null;
      }

      // Prepare notification content
      const notificationTitle = "🎯 New Campaign Available!";
      const notificationBody = `Check out "${campaignData.title}" - ${campaignData.type}`;

      // Prepare messages for Expo
      const messages = expoPushTokens.map((token) => ({
        to: token,
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: "campaign",
          id: campaignId,
          title: campaignData.title,
          type: campaignData.type,
        },
        sound: "default",
        priority: "high",
        channelId: "default", // For Android
      }));

      // Send in batches of 100 (Expo's limit)
      const batchSize = 100;
      let totalSent = 0;
      let totalFailed = 0;

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);

        try {
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(batch),
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`Batch ${Math.floor(i / batchSize) + 1} sent:`, result);
            totalSent += batch.length;
          } else {
            console.error(
              `Batch ${Math.floor(i / batchSize) + 1} failed:`,
              await response.text()
            );
            totalFailed += batch.length;
          }
        } catch (error) {
          console.error(
            `Error sending batch ${Math.floor(i / batchSize) + 1}:`,
            error
          );
          totalFailed += batch.length;
        }

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < messages.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      console.log(
        `Campaign notifications sent: ${totalSent} successful, ${totalFailed} failed`
      );
      return null;
    } catch (error) {
      console.error("Error sending campaign notifications:", error);
      throw error;
    }
  }
);

/**
 * Cloud Function to schedule webinar reminders when webinar is created or updated
 * Creates/updates scheduled tasks for each reminder time
 */
exports.scheduleWebinarReminders = onDocumentWritten(
  "webinars/{webinarId}",
  async (event) => {
    const webinarId = event.params.webinarId;
    const beforeData = event.data.before?.data();
    const afterData = event.data.after?.data();

    // Skip if webinar was deleted
    if (!afterData) {
      console.log(`Webinar ${webinarId} was deleted, cleaning up schedules`);
      // Clean up existing schedules
      const existingSchedules = await db
        .collection("webinar_reminder_schedules")
        .where("webinarId", "==", webinarId)
        .get();

      const batch = db.batch();
      existingSchedules.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      return null;
    }

    // Check if this is a new webinar or an update
    const isNewWebinar = !beforeData;
    const isTimeChange =
      beforeData &&
      (beforeData.date?.toDate()?.getTime() !==
        afterData.date?.toDate()?.getTime() ||
        beforeData.startTime?.toDate()?.getTime() !==
          afterData.startTime?.toDate()?.getTime());

    if (isNewWebinar) {
      console.log(`New webinar created: ${webinarId}, scheduling reminders`);
    } else if (isTimeChange) {
      console.log(
        `Webinar ${webinarId} time changed, updating reminder schedules`
      );
    } else {
      console.log(
        `Webinar ${webinarId} updated (no time change), skipping reminder reschedule`
      );
      return null;
    }

    try {
      // Combine date and startTime for accurate webinar start time
      const webinarDate = afterData.date.toDate();
      const startTime = afterData.startTime.toDate();
      const webinarStart = new Date(
        webinarDate.getFullYear(),
        webinarDate.getMonth(),
        webinarDate.getDate(),
        startTime.getHours(),
        startTime.getMinutes(),
        startTime.getSeconds()
      );

      const now = new Date();

      // Define reminder intervals
      const reminderIntervals = [
        { name: "24h", ms: 24 * 60 * 60 * 1000, label: "24 hours" },
        { name: "1h", ms: 60 * 60 * 1000, label: "1 hour" },
        { name: "30m", ms: 30 * 60 * 1000, label: "30 minutes" },
        { name: "10m", ms: 10 * 60 * 1000, label: "10 minutes" },
      ];

      // If this is a time change, clean up existing schedules first
      if (isTimeChange) {
        const existingSchedules = await db
          .collection("webinar_reminder_schedules")
          .where("webinarId", "==", webinarId)
          .get();

        const batch = db.batch();
        existingSchedules.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(
          `Cleaned up ${existingSchedules.docs.length} old reminder schedules`
        );
      }

      // Schedule each reminder if it's in the future
      for (const interval of reminderIntervals) {
        const reminderTime = new Date(webinarStart.getTime() - interval.ms);

        if (reminderTime > now) {
          // Store reminder schedule in Firestore for the scheduled function to pick up
          await db
            .collection("webinar_reminder_schedules")
            .doc(`${webinarId}_${interval.name}`)
            .set({
              webinarId: webinarId,
              webinarTitle: afterData.title,
              webinarStart: webinarStart,
              reminderType: interval.name,
              reminderLabel: interval.label,
              scheduledFor: reminderTime,
              status: "scheduled",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

          console.log(
            `Scheduled ${
              interval.label
            } reminder for ${reminderTime.toISOString()}`
          );
        } else {
          console.log(`Skipping ${interval.label} reminder (too late)`);
        }
      }

      // If this was a time change, send notification to RSVPed users about the change
      if (isTimeChange && afterData.joined && afterData.joined.length > 0) {
        console.log(
          `Sending time change notification to ${afterData.joined.length} RSVPed users`
        );

        for (const userId of afterData.joined) {
          try {
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists && userDoc.data().expoPushToken) {
              const userData = userDoc.data();

              const notification = {
                to: userData.expoPushToken,
                title: "📅 Webinar Time Changed",
                body: `"${afterData.title}" time has been updated. Check the new schedule!`,
                data: {
                  type: "webinar_time_changed",
                  webinarId: webinarId,
                  webinarTitle: afterData.title,
                  newStartTime: webinarStart.toISOString(),
                },
                sound: "default",
                priority: "high",
                channelId: "webinar-reminders",
              };

              const response = await fetch(
                "https://exp.host/--/api/v2/push/send",
                {
                  method: "POST",
                  headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify([notification]),
                }
              );

              if (response.ok) {
                console.log(`Time change notification sent to user ${userId}`);
              }
            }
          } catch (error) {
            console.error(
              `Error sending time change notification to user ${userId}:`,
              error
            );
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error scheduling webinar reminders:", error);
      return null;
    }
  }
);

/**
 * Cloud Function to handle webinar RSVP changes
 * Sends confirmation notifications when users RSVP/un-RSVP
 */
exports.onWebinarRSVPChange = onDocumentWritten(
  "webinars/{webinarId}",
  async (event) => {
    const webinarId = event.params.webinarId;
    const beforeData = event.data.before?.data();
    const afterData = event.data.after?.data();

    // Skip if this is a new webinar creation (no before data)
    if (!beforeData || !afterData) {
      return null;
    }

    const beforeJoined = beforeData.joined || [];
    const afterJoined = afterData.joined || [];

    // Find who newly joined (RSVP'd)
    const newlyJoined = afterJoined.filter(
      (uid) => !beforeJoined.includes(uid)
    );

    // Find who left (un-RSVP'd)
    const newlyLeft = beforeJoined.filter((uid) => !afterJoined.includes(uid));

    try {
      // Send welcome notification to newly joined users
      if (newlyJoined.length > 0) {
        const webinarDate = afterData.date.toDate();
        const startTime = afterData.startTime.toDate();
        const webinarStart = new Date(
          webinarDate.getFullYear(),
          webinarDate.getMonth(),
          webinarDate.getDate(),
          startTime.getHours(),
          startTime.getMinutes(),
          startTime.getSeconds()
        );

        for (const userId of newlyJoined) {
          try {
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists && userDoc.data().expoPushToken) {
              const userData = userDoc.data();

              const notification = {
                to: userData.expoPushToken,
                title: "🎉 RSVP Confirmed!",
                body: `You're registered for "${afterData.title}". We'll send you reminders before it starts!`,
                data: {
                  type: "webinar_rsvp_confirmed",
                  webinarId: webinarId,
                  webinarTitle: afterData.title,
                  startTime: webinarStart.toISOString(),
                },
                sound: "default",
                priority: "high",
                channelId: "webinar-reminders",
              };

              const response = await fetch(
                "https://exp.host/--/api/v2/push/send",
                {
                  method: "POST",
                  headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify([notification]),
                }
              );

              if (response.ok) {
                console.log(
                  `RSVP confirmation sent to user ${userId} for webinar: ${afterData.title}`
                );
              }
            }
          } catch (error) {
            console.error(
              `Error sending RSVP confirmation to user ${userId}:`,
              error
            );
          }
        }
      }

      // Send cancellation notification to users who un-RSVP'd
      if (newlyLeft.length > 0) {
        for (const userId of newlyLeft) {
          try {
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists && userDoc.data().expoPushToken) {
              const userData = userDoc.data();

              const notification = {
                to: userData.expoPushToken,
                title: "RSVP Cancelled",
                body: `You've been removed from "${afterData.title}". You won't receive reminder notifications.`,
                data: {
                  type: "webinar_rsvp_cancelled",
                  webinarId: webinarId,
                  webinarTitle: afterData.title,
                },
                sound: "default",
                priority: "normal",
                channelId: "webinar-reminders",
              };

              const response = await fetch(
                "https://exp.host/--/api/v2/push/send",
                {
                  method: "POST",
                  headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify([notification]),
                }
              );

              if (response.ok) {
                console.log(
                  `RSVP cancellation sent to user ${userId} for webinar: ${afterData.title}`
                );
              }
            }
          } catch (error) {
            console.error(
              `Error sending RSVP cancellation to user ${userId}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error("Error handling webinar RSVP changes:", error);
    }

    return null;
  }
);

/**
 * Cloud Function to send webinar reminder notifications
 * Runs every 10 minutes to check scheduled reminders (highly optimized)
 */
exports.sendWebinarReminders = onSchedule("every 10 minutes", async (event) => {
  console.log("Starting optimized webinar reminder check");

  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Get scheduled reminders that are due (within 5 minutes window)
    const scheduledReminders = await db
      .collection("webinar_reminder_schedules")
      .where("scheduledFor", ">=", fiveMinutesAgo)
      .where("scheduledFor", "<=", fiveMinutesFromNow)
      .where("status", "==", "scheduled")
      .get();

    console.log(`Found ${scheduledReminders.docs.length} reminders to send`);

    for (const reminderDoc of scheduledReminders.docs) {
      const reminderData = reminderDoc.data();
      const reminderId = reminderDoc.id;

      try {
        // Get the current webinar data to check RSVPs
        const webinarDoc = await db
          .collection("webinars")
          .doc(reminderData.webinarId)
          .get();

        if (!webinarDoc.exists) {
          console.log(
            `Webinar ${reminderData.webinarId} no longer exists, skipping reminder`
          );
          continue;
        }

        const webinar = webinarDoc.data();

        // Skip if no one has RSVPed
        if (!webinar.joined || webinar.joined.length === 0) {
          console.log(
            `No RSVPs for webinar ${reminderData.webinarId}, skipping reminder`
          );
          continue;
        }

        // Check if we've already sent this reminder
        const sentReminderDoc = await db
          .collection("webinar_reminders_sent")
          .doc(reminderId)
          .get();

        if (sentReminderDoc.exists) {
          console.log(`Reminder ${reminderId} already sent, skipping`);
          continue;
        }

        console.log(
          `Sending ${reminderData.reminderLabel} reminder for webinar: ${reminderData.webinarTitle}`
        );

        // Get all RSVPed users with push tokens
        const userPromises = webinar.joined.map((userId) =>
          db.collection("users").doc(userId).get()
        );

        const userDocs = await Promise.all(userPromises);
        const validUsers = userDocs
          .filter((doc) => doc.exists && doc.data().expoPushToken)
          .map((doc) => ({
            id: doc.id,
            expoPushToken: doc.data().expoPushToken,
            name: doc.data().name || "User",
          }));

        if (validUsers.length > 0) {
          // Prepare notification messages
          const messages = validUsers.map((user) => ({
            to: user.expoPushToken,
            title: `🎓 Webinar Reminder - ${reminderData.reminderLabel} left!`,
            body: `"${reminderData.webinarTitle}" starts in ${reminderData.reminderLabel}. Get ready to join!`,
            data: {
              type: "webinar_reminder",
              webinarId: reminderData.webinarId,
              webinarTitle: reminderData.webinarTitle,
              reminderType: reminderData.reminderType,
              webinarLink: webinar.link || "",
              startTime: reminderData.webinarStart.toDate().toISOString(),
            },
            sound: "default",
            priority: "high",
            channelId: "webinar-reminders",
          }));

          // Send notifications in batches
          const batchSize = 100;
          let totalSent = 0;
          let totalFailed = 0;

          for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);

            try {
              const response = await fetch(
                "https://exp.host/--/api/v2/push/send",
                {
                  method: "POST",
                  headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(batch),
                }
              );

              if (response.ok) {
                const result = await response.json();
                console.log(
                  `Batch ${Math.floor(i / batchSize) + 1} sent for ${
                    reminderData.reminderLabel
                  } reminder`
                );
                totalSent += batch.length;
              } else {
                console.error(
                  `Batch ${Math.floor(i / batchSize) + 1} failed:`,
                  await response.text()
                );
                totalFailed += batch.length;
              }
            } catch (error) {
              console.error(
                `Error sending batch ${Math.floor(i / batchSize) + 1}:`,
                error
              );
              totalFailed += batch.length;
            }

            // Small delay between batches
            if (i + batchSize < messages.length) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          // Mark this reminder as sent
          await db.collection("webinar_reminders_sent").doc(reminderId).set({
            webinarId: reminderData.webinarId,
            webinarTitle: reminderData.webinarTitle,
            reminderType: reminderData.reminderType,
            reminderLabel: reminderData.reminderLabel,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            userCount: validUsers.length,
            totalSent: totalSent,
            totalFailed: totalFailed,
            webinarStartTime: reminderData.webinarStart,
          });

          // Update schedule status
          await db
            .collection("webinar_reminder_schedules")
            .doc(reminderId)
            .update({
              status: "sent",
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
            });

          console.log(
            `✅ ${reminderData.reminderLabel} reminder sent to ${totalSent} users for webinar: ${reminderData.webinarTitle}`
          );
        } else {
          console.log(
            `No valid users with push tokens for ${reminderData.reminderLabel} reminder`
          );
        }
      } catch (error) {
        console.error(`Error processing reminder ${reminderId}:`, error);
      }
    }

    // Clean up old records (only run occasionally)
    if (Math.random() < 0.05) {
      // 5% chance to run cleanup
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Clean up old sent reminders
      const oldSentReminders = await db
        .collection("webinar_reminders_sent")
        .where("sentAt", "<", sevenDaysAgo)
        .get();

      if (oldSentReminders.docs.length > 0) {
        const deletePromises = oldSentReminders.docs.map((doc) =>
          doc.ref.delete()
        );
        await Promise.all(deletePromises);
        console.log(
          `Cleaned up ${oldSentReminders.docs.length} old sent reminder records`
        );
      }

      // Clean up old schedules
      const oldSchedules = await db
        .collection("webinar_reminder_schedules")
        .where("createdAt", "<", sevenDaysAgo)
        .get();

      if (oldSchedules.docs.length > 0) {
        const deletePromises = oldSchedules.docs.map((doc) => doc.ref.delete());
        await Promise.all(deletePromises);
        console.log(
          `Cleaned up ${oldSchedules.docs.length} old schedule records`
        );
      }
    }

    console.log("Optimized webinar reminder check completed");
    return null;
  } catch (error) {
    console.error("Error in optimized webinar reminder check:", error);
    return null;
  }
});

/**
 * Cloud Function to update badge counts for all users
 * Runs twice daily: once in the morning (9 AM) and once in the evening (9 PM)
 */
exports.updateAllUserBadges = onSchedule("0 9,21 * * *", async (event) => {
  console.log("Starting scheduled badge update for all users");

  try {
    // Get all users with expo push tokens
    const usersSnapshot = await db
      .collection("users")
      .where("expoPushToken", "!=", null)
      .get();

    console.log(`Found ${usersSnapshot.docs.length} users with push tokens`);

    if (usersSnapshot.docs.length === 0) {
      console.log("No users with push tokens found");
      return null;
    }

    // Process users in batches to avoid timeout
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(usersSnapshot.docs.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = Math.min(
        startIndex + BATCH_SIZE,
        usersSnapshot.docs.length
      );
      const batchUsers = usersSnapshot.docs.slice(startIndex, endIndex);

      console.log(
        `Processing batch ${batchIndex + 1}/${totalBatches} (${
          batchUsers.length
        } users)`
      );

      // Process each user in this batch
      const batchPromises = batchUsers.map(async (userDoc) => {
        const userId = userDoc.id;
        const userData = userDoc.data();

        try {
          const lastRead = userData.lastRead || {};
          const isAdmin = userData.isAdmin || userData.role === "admin";
          const expoPushToken = userData.expoPushToken;

          if (!expoPushToken) {
            console.log(`No push token for user ${userId}`);
            return;
          }

          // Calculate unread chats count for this user
          let unreadCount = 0;

          // Check global chat
          const globalChatQuery = await db
            .collection("globalChat")
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();

          if (!globalChatQuery.empty) {
            const latest = globalChatQuery.docs[0].data().createdAt;
            const lastReadTime = lastRead["general"];
            if (
              latest &&
              (!lastReadTime ||
                (latest.seconds || latest._seconds || 0) >
                  (lastReadTime.seconds || lastReadTime._seconds || 0))
            ) {
              unreadCount++;
            }
          }

          // Check subchats
          const subChatsSnapshot = await db.collection("subChats").get();
          for (const subChatDoc of subChatsSnapshot.docs) {
            const subChatData = subChatDoc.data();
            // Check if user is member or admin
            if (
              isAdmin ||
              (subChatData.members && subChatData.members.includes(userId))
            ) {
              const key = `subchat_${subChatDoc.id}`;
              // Get latest message
              const messagesQuery = await db
                .collection("subChats")
                .doc(subChatDoc.id)
                .collection("messages")
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();

              if (!messagesQuery.empty) {
                const latest = messagesQuery.docs[0].data().createdAt;
                const lastReadTime = lastRead[key];
                if (
                  latest &&
                  (!lastReadTime ||
                    (latest.seconds || latest._seconds || 0) >
                      (lastReadTime.seconds || lastReadTime._seconds || 0))
                ) {
                  unreadCount++;
                }
              }
            }
          }

          // Check campaigns
          const campaignsSnapshot = await db.collection("campaigns").get();
          for (const campaignDoc of campaignsSnapshot.docs) {
            const campaignData = campaignDoc.data();
            const allMembers = [
              ...(campaignData.applied || []),
              ...(campaignData.approved || []),
              ...(campaignData.rejected || []),
            ];

            // Check if user is involved or admin
            if (isAdmin || allMembers.includes(userId)) {
              const key = `campaign_${campaignDoc.id}`;
              // Get latest message from approved users
              const chatQuery = await db
                .collection("campaigns")
                .doc(campaignDoc.id)
                .collection("chat")
                .orderBy("createdAt", "desc")
                .limit(5)
                .get();

              let latest = null;
              const approved = new Set(campaignData.approved || []);
              chatQuery.forEach((msgDoc) => {
                const msgData = msgDoc.data();
                if (
                  !latest &&
                  (approved.size === 0 || approved.has(msgData.userId))
                ) {
                  latest = msgData.createdAt;
                }
              });

              if (latest) {
                const lastReadTime = lastRead[key];
                if (
                  !lastReadTime ||
                  (latest.seconds || latest._seconds || 0) >
                    (lastReadTime.seconds || lastReadTime._seconds || 0)
                ) {
                  unreadCount++;
                }
              }
            }
          }

          console.log(`User ${userId} has ${unreadCount} unread chats`);

          // Send silent push notification with badge count
          if (unreadCount > 0) {
            const notification = {
              to: expoPushToken,
              badge: unreadCount,
              sound: null, // Silent notification
              title: null,
              body: null,
              data: {
                type: "badge_update",
                count: unreadCount,
              },
            };

            const response = await fetch(
              "https://exp.host/--/api/v2/push/send",
              {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Accept-encoding": "gzip, deflate",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify([notification]),
              }
            );

            const result = await response.json();
            console.log(`Badge update sent to ${userId}:`, result);
          } else {
            // Clear badge if no unread chats
            const notification = {
              to: expoPushToken,
              badge: 0,
              sound: null,
              title: null,
              body: null,
              data: {
                type: "badge_clear",
              },
            };

            const response = await fetch(
              "https://exp.host/--/api/v2/push/send",
              {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Accept-encoding": "gzip, deflate",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify([notification]),
              }
            );

            console.log(`Badge cleared for ${userId}`);
          }
        } catch (error) {
          console.error(`Error updating badge for user ${userId}:`, error);
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to avoid rate limiting
      if (batchIndex < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log("Scheduled badge update completed successfully");
    return null;
  } catch (error) {
    console.error("Error in scheduled badge update:", error);
    return null;
  }
});
