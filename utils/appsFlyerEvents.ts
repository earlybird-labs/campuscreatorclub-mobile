import { appsFlyerService } from "@/services/appsFlyerService";
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";

/**
 * Check if current user is a regular user (not admin or ambassador)
 */
export async function isRegularUser(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;

  try {
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return false;

    const userData = userDoc.data();
    const role = userData?.role || "user";
    const isAmbassador = userData?.isAmbassador || false;
    const isAdmin = userData?.isAdmin || false;

    // Regular user if: role is "user" AND not ambassador AND not admin
    return role === "user" && !isAmbassador && !isAdmin;
  } catch (error) {
    console.error("Error checking user role:", error);
    return false;
  }
}

/**
 * AppsFlyer event tracking helpers for regular users only
 */

/**
 * Track user registration completion
 * AppsFlyer standard event: af_complete_registration
 */
export async function trackRegistrationComplete(
  userId: string | null | undefined,
  registrationMethod?: string
) {
  if (!(await isRegularUser(userId))) return;

  appsFlyerService.logEvent("af_complete_registration", {
    af_registration_method: registrationMethod || "email",
  });
}

/**
 * Track user login
 * AppsFlyer standard event: af_login
 */
export async function trackLogin(
  userId: string | null | undefined,
  loginMethod?: string
) {
  if (!(await isRegularUser(userId))) return;

  appsFlyerService.logEvent("af_login", {
    af_login_method: loginMethod || "email",
  });
}

/**
 * Track campaign viewed
 */
export async function trackCampaignViewed(
  userId: string | null | undefined,
  campaignId: string,
  campaignTitle?: string
) {
  if (!(await isRegularUser(userId))) return;

  appsFlyerService.logEvent("campaign_viewed", {
    campaign_id: campaignId,
    campaign_title: campaignTitle || "",
  });
}

/**
 * Track campaign application
 */
export async function trackCampaignApplied(
  userId: string | null | undefined,
  campaignId: string,
  campaignTitle?: string,
  campaignType?: string
) {
  if (!(await isRegularUser(userId))) return;

  appsFlyerService.logEvent("campaign_applied", {
    campaign_id: campaignId,
    campaign_title: campaignTitle || "",
    campaign_type: campaignType || "",
  });
}

/**
 * Track campaign content upload
 */
export async function trackCampaignContentUploaded(
  userId: string | null | undefined,
  campaignId: string,
  campaignTitle?: string
) {
  if (!(await isRegularUser(userId))) return;

  appsFlyerService.logEvent("campaign_content_uploaded", {
    campaign_id: campaignId,
    campaign_title: campaignTitle || "",
  });
}

/**
 * Track announcement viewed
 */
export async function trackAnnouncementViewed(
  userId: string | null | undefined,
  announcementId: string,
  announcementTitle?: string
) {
  if (!(await isRegularUser(userId))) return;

  appsFlyerService.logEvent("announcement_viewed", {
    announcement_id: announcementId,
    announcement_title: announcementTitle || "",
  });
}

/**
 * Track webinar joined/RSVP
 */
export async function trackWebinarJoined(
  userId: string | null | undefined,
  webinarId: string,
  webinarTitle?: string
) {
  if (!(await isRegularUser(userId))) return;

  appsFlyerService.logEvent("webinar_joined", {
    webinar_id: webinarId,
    webinar_title: webinarTitle || "",
  });
}

/**
 * Track profile updated
 */
export async function trackProfileUpdated(userId: string | null | undefined) {
  if (!(await isRegularUser(userId))) return;

  appsFlyerService.logEvent("profile_updated", {});
}
