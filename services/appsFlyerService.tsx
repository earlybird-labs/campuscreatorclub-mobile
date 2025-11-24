import appsFlyer from "react-native-appsflyer";
import { Platform } from "react-native";

class AppsFlyerService {
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private pendingCustomerUserId: string | null = null;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize AppsFlyer SDK
   */
  async initialize() {
    // Prevent multiple simultaneous initializations
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      console.log(
        "═══════════════════════════════════════════════════════════"
      );
      console.log("🚀 STARTING APPSFLYER SDK INITIALIZATION");
      console.log(
        "═══════════════════════════════════════════════════════════"
      );

      const devKey = process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY;
      const appId = process.env.EXPO_PUBLIC_APPSFLYER_APP_ID;

      if (!devKey) {
        console.error(
          "AppsFlyer devKey is missing. Please set EXPO_PUBLIC_APPSFLYER_DEV_KEY in .env"
        );
        this.isInitializing = false;
        return;
      }

      if (Platform.OS === "ios" && !appId) {
        console.error(
          "AppsFlyer appId is missing. Please set EXPO_PUBLIC_APPSFLYER_APP_ID in .env"
        );
        this.isInitializing = false;
        return;
      }

      const initOptions: any = {
        devKey: devKey,
        isDebug: __DEV__, // Enable debug mode in development
        onInstallConversionDataListener: true, // Listen for conversion data (install attribution)
        onDeepLinkListener: true, // Listen for deep links
        onAppOpenAttribution: true, // Handle attribution from non-AppsFlyer sources
      };

      // Add appId for iOS
      if (Platform.OS === "ios" && appId) {
        initOptions.appId = appId;
        // Wait for ATT authorization (iOS 14.5+)
        // Increased timeout to 60 seconds to allow time for user to respond to ATT prompt
        initOptions.timeToWaitForATTUserAuthorization = 60;
      }

      // Set up listeners BEFORE calling initSdk to ensure we don't miss any attribution data
      // This prevents over-attribution by ensuring each listener is set up only once

      // Set up conversion data listener (install attribution)
      appsFlyer.onInstallConversionData((conversionData) => {
        // Only process if this is valid conversion data
        if (!conversionData?.data) {
          return;
        }

        const data = conversionData.data;

        // Log first launch detection
        if (data.is_first_launch === "true") {
          console.log(
            "═══════════════════════════════════════════════════════════"
          );
          console.log("✅ FIRST APP LAUNCH DETECTED - Install Attribution");
          console.log(
            "═══════════════════════════════════════════════════════════"
          );
        }

        // Log attribution status
        const afStatus = data.af_status;
        if (afStatus) {
          console.log(
            "═══════════════════════════════════════════════════════════"
          );
          console.log("📊 ATTRIBUTION STATUS:", afStatus);
          if (afStatus === "Non-organic") {
            console.log("   Media Source:", data.media_source);
            console.log("   Campaign:", data.campaign);
          }
          console.log(
            "═══════════════════════════════════════════════════════════"
          );
        }

        // Log AppsFlyer UID from conversion data if available
        if (data.af_uid) {
          console.log(
            "═══════════════════════════════════════════════════════════"
          );
          console.log(
            "📱 APPSFLYER INSTALL UID (from conversion data):",
            data.af_uid
          );
          console.log(
            "   Copy this UID and paste it into the AppsFlyer test wizard"
          );
          console.log(
            "═══════════════════════════════════════════════════════════"
          );
        }
      });

      // Set up app open attribution listener (for non-AppsFlyer sources)
      appsFlyer.onAppOpenAttribution((attributionData) => {
        // Only process if this is valid attribution data
        if (!attributionData?.data) {
          return;
        }

        const data = attributionData.data;
        console.log(
          "═══════════════════════════════════════════════════════════"
        );
        console.log("📊 APP OPEN ATTRIBUTION");
        console.log("   Media Source:", data.media_source);
        console.log("   Campaign:", data.campaign);
        console.log(
          "═══════════════════════════════════════════════════════════"
        );
      });

      // Set up deep link listener (for deep links only, not installs)
      appsFlyer.onDeepLink((deepLinkResult) => {
        // Only process if this is a valid deep link (not an install)
        if (!deepLinkResult?.data) {
          return;
        }

        const deepLinkValue = deepLinkResult.data;

        // Log deep link data for reading/analysis
        console.log(
          "═══════════════════════════════════════════════════════════"
        );
        if (deepLinkResult.isDeferred === false) {
          console.log("🔗 DIRECT DEEP LINK RECEIVED");
        } else if (deepLinkResult.isDeferred === true) {
          console.log("🔗 DEFERRED DEEP LINK RECEIVED");
        }
        console.log("   Deep Link Data:", deepLinkValue);
        console.log(
          "═══════════════════════════════════════════════════════════"
        );

        // Deep link data is available in deepLinkValue for reading
        // No navigation needed - just reading as requested
      });

      // Create a promise that resolves when initialization completes
      this.initializationPromise = new Promise<void>((resolve, reject) => {
        appsFlyer.initSdk(
          initOptions,
          (result) => {
            console.log(
              "═══════════════════════════════════════════════════════════"
            );
            console.log("✅ APPSFLYER SDK INITIALIZED SUCCESSFULLY");
            console.log(
              "═══════════════════════════════════════════════════════════"
            );
            this.isInitialized = true;
            this.isInitializing = false;

            // Process any pending customer user ID
            if (this.pendingCustomerUserId) {
              this.setCustomerUserId(this.pendingCustomerUserId);
              this.pendingCustomerUserId = null;
            }

            // Retrieve and log AppsFlyer UID for testing
            this.logAppsFlyerUID();

            resolve();
          },
          (error) => {
            console.error("AppsFlyer SDK initialization error:", error);
            this.isInitializing = false;
            this.pendingCustomerUserId = null; // Clear pending ID on error
            reject(error);
          }
        );
      });

      // Wait for initialization promise to resolve/reject
      await this.initializationPromise;
    } catch (error) {
      console.error("Error initializing AppsFlyer service:", error);
      this.isInitializing = false;
    }
  }

  /**
   * Log an in-app event
   */
  logEvent(eventName: string, eventValues?: Record<string, any>) {
    if (!this.isInitialized) {
      return;
    }

    try {
      // AppsFlyer requires eventValues to be an object, default to empty object if undefined
      const eventValuesObj = eventValues || {};
      appsFlyer.logEvent(
        eventName,
        eventValuesObj,
        (success) => {
          console.log(`📊 APPSFLYER EVENT LOGGED: ${eventName}`);
        },
        (error) => {
          console.error(
            "═══════════════════════════════════════════════════════════"
          );
          console.error(`❌ APPSFLYER EVENT ERROR: ${eventName}`);
          console.error("   Error:", error);
          console.error(
            "═══════════════════════════════════════════════════════════"
          );
        }
      );
    } catch (error) {
      console.error(
        "═══════════════════════════════════════════════════════════"
      );
      console.error(`❌ ERROR LOGGING APPSFLYER EVENT: ${eventName}`);
      console.error("   Error:", error);
      console.error(
        "═══════════════════════════════════════════════════════════"
      );
    }
  }

  /**
   * Set customer user ID
   * This method will queue the user ID if SDK is not yet initialized,
   * and set it once initialization completes.
   */
  setCustomerUserId(userId: string) {
    if (!userId || userId.trim() === "") {
      return;
    }

    // If SDK is initialized, set it immediately
    if (this.isInitialized) {
      this._setCustomerUserIdImmediate(userId);
      return;
    }

    // If SDK is still initializing, queue it (will be processed in init callback)
    if (this.isInitializing) {
      this.pendingCustomerUserId = userId;
      return;
    }

    // SDK not initialized and not initializing - queue it
    this.pendingCustomerUserId = userId;
  }

  /**
   * Internal method to set customer user ID immediately (assumes SDK is initialized)
   */
  private _setCustomerUserIdImmediate(userId: string) {
    try {
      // setCustomerUserId only accepts userId and optional success callback (no error callback)
      appsFlyer.setCustomerUserId(userId, (success) => {
        console.log(
          "═══════════════════════════════════════════════════════════"
        );
        console.log("👤 APPSFLYER CUSTOMER USER ID SET");
        console.log("   User ID:", userId);
        console.log(
          "═══════════════════════════════════════════════════════════"
        );
      });
    } catch (error) {
      console.error(
        "═══════════════════════════════════════════════════════════"
      );
      console.error("❌ ERROR SETTING APPSFLYER CUSTOMER USER ID");
      console.error("   Error:", error);
      console.error(
        "═══════════════════════════════════════════════════════════"
      );
    }
  }

  /**
   * Get initialization status
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Retrieve and log AppsFlyer UID for testing purposes
   * This is the install UID that AppsFlyer uses for tracking
   */
  private logAppsFlyerUID() {
    if (!this.isInitialized) {
      console.warn("AppsFlyer not initialized. Cannot get UID");
      return;
    }

    try {
      appsFlyer.getAppsFlyerUID((error, uid) => {
        if (error) {
          console.error("Error retrieving AppsFlyer UID:", error);
        } else if (uid) {
          console.log(
            "═══════════════════════════════════════════════════════════"
          );
          console.log("📱 APPSFLYER INSTALL UID (for testing):", uid);
          console.log(
            "   Copy this UID and paste it into the AppsFlyer test wizard"
          );
          console.log(
            "   URL: https://dj.dev.appsflyer.com/startsdk/ios/testsdkuid"
          );
          console.log(
            "═══════════════════════════════════════════════════════════"
          );
        }
      });
    } catch (error) {
      console.error("Error getting AppsFlyer UID:", error);
    }
  }
}

export const appsFlyerService = new AppsFlyerService();
