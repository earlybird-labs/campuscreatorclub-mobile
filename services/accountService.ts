import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
} from "@react-native-firebase/firestore";

const db = getFirestore();

export interface DeletedUserData {
  uid: string;
  originalData: any; // Store the complete original user data
  deletedAt: Date;
}

/**
 * Soft delete a user account by moving their data to deleted_users collection
 * @param userId - The user's UID
 * @param userData - The complete user data to be moved
 * @returns Promise<boolean> - Success status
 */
export const softDeleteAccount = async (
  userId: string,
  userData: any
): Promise<boolean> => {
  try {
    // Create deleted user data (simplified - no recovery codes)
    const deletedUserData: DeletedUserData = {
      uid: userId,
      originalData: userData,
      deletedAt: new Date(),
    };

    // Move user data to deleted_users collection
    await setDoc(doc(db, "deleted_users", userId), deletedUserData);

    // Delete from original users collection
    await deleteDoc(doc(db, "users", userId));

    console.log("Account soft deleted successfully:", userId);
    return true;
  } catch (error) {
    console.error("Error soft deleting account:", error);
    return false;
  }
};

/**
 * Check if a user exists in the deleted_users collection
 * @param userId - The user's UID
 * @returns Promise<DeletedUserData | null> - Deleted user data if found, null otherwise
 */
export const checkDeletedUser = async (
  userId: string
): Promise<DeletedUserData | null> => {
  try {
    const deletedUserDoc = await getDoc(doc(db, "deleted_users", userId));

    if (deletedUserDoc.exists()) {
      return deletedUserDoc.data() as DeletedUserData;
    }

    return null;
  } catch (error) {
    console.error("Error checking deleted user:", error);
    return null;
  }
};

/**
 * Restore a deleted user account (simplified - no recovery codes)
 * @param userId - The user's UID
 * @returns Promise<boolean> - Success status
 */
export const restoreAccount = async (userId: string): Promise<boolean> => {
  try {
    const deletedUserDoc = await getDoc(doc(db, "deleted_users", userId));

    if (!deletedUserDoc.exists()) {
      throw new Error("Deleted user not found");
    }

    const deletedUserData = deletedUserDoc.data() as DeletedUserData;

    // Restore user data to users collection
    await setDoc(doc(db, "users", userId), deletedUserData.originalData);

    // Remove from deleted_users collection
    await deleteDoc(doc(db, "deleted_users", userId));

    console.log("Account restored successfully:", userId);
    return true;
  } catch (error) {
    console.error("Error restoring account:", error);
    return false;
  }
};