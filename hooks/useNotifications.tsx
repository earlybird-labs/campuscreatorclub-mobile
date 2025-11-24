// This hook is now deprecated - notifications are handled by Cloud Functions
// Keeping this file for potential future use but removing all sending functions
// to prevent duplicate notifications

export const useNotifications = () => {
  // All notification sending functions have been removed
  // Notifications are now handled exclusively by Cloud Functions:
  // - Campaign notifications: sendCampaignNotifications
  // - Announcement notifications: sendAnnouncementNotifications
  // - Webinar notifications: scheduleWebinarReminders + sendWebinarReminders
  // - @everyone notifications: sendEveryoneNotifications

  return {
    // No functions exported - all notifications handled server-side
  };
};
