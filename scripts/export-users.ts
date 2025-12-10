#!/usr/bin/env node

/**
 * Script to export users collection from Firestore to CSV
 * 
 * Usage:
 *   npx tsx scripts/export-users.ts [output-file.csv]
 *   or
 *   npm run export-users [output-file.csv]
 * 
 * Examples:
 *   npm run export-users
 *   npm run export-users users.csv
 *   npm run export-users ./exports/users-2024.csv
 * 
 * Note: [output-file.csv] is optional. If not provided, defaults to "users-export.csv"
 *       Do not include the brackets when running the command - they are just notation.
 * 
 * Requirements:
 *   - Application Default Credentials (ADC) for Firebase Admin SDK
 *   - After running `firebase login`, you also need to run:
 *     gcloud auth application-default login
 *   - Or use a service account key file via GOOGLE_APPLICATION_CREDENTIALS env var
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Read project ID from .firebaserc
function getProjectId(): string {
  try {
    const firebasercPath = path.join(process.cwd(), ".firebaserc");
    const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, "utf8"));
    return firebaserc.projects?.default || "campus-creator-club";
  } catch (error) {
    return "campus-creator-club";
  }
}

// Initialize Firebase Admin
// Uses Application Default Credentials (set up via: gcloud auth application-default login)
// Project ID must be explicitly set for local scripts (cloud functions get it automatically)
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: getProjectId(),
  });
}

const db = admin.firestore();

/**
 * Convert a value to CSV-safe string
 */
function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  
  // Convert to string
  let str: string = String(value);
  
  // Handle objects and arrays
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      str = value.join("; ");
    } else if (value.toDate && typeof value.toDate === "function") {
      // Firestore Timestamp
      str = value.toDate().toISOString();
    } else {
      str = JSON.stringify(value);
    }
  }
  
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

/**
 * Flatten nested objects for CSV export
 */
function flattenObject(obj: Record<string, any>, prefix: string = ""): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        flattened[newKey] = "";
      } else if (value.toDate && typeof value.toDate === "function") {
        // Firestore Timestamp
        flattened[newKey] = value.toDate().toISOString();
      } else if (Array.isArray(value)) {
        flattened[newKey] = value.join("; ");
      } else if (typeof value === "object" && value.constructor === Object) {
        // Recursively flatten nested objects
        Object.assign(flattened, flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }
  }
  
  return flattened;
}

/**
 * Export users to CSV - only user profile fields
 */
async function exportUsersToCSV(outputPath: string): Promise<void> {
  try {
    console.log("Fetching users from Firestore...");
    
    // Get all users
    const usersSnapshot = await db.collection("users").get();
    
    if (usersSnapshot.empty) {
      console.log("No users found in the collection.");
      return;
    }
    
    console.log(`Found ${usersSnapshot.size} users. Processing...`);
    
    // Define which fields to export (user profile data only)
    const fieldsToExport = [
      "uid",
      "name",
      "email",
      "phoneNumber",
      "bio",
      "birthday",
      "instagram",
      "tiktok",
      "university",
      "photoUrl",
      "role",
      "hasCompletedOnboarding",
    ];
    
    // Build CSV content
    const rows: string[] = [];
    
    // Header row
    rows.push(fieldsToExport.map((field) => escapeCSV(field)).join(","));
    
    // Data rows
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      
      const row = fieldsToExport.map((field) => {
        let value: any;
        
        if (field === "uid") {
          value = doc.id;
        } else {
          value = data[field];
        }
        
        // Handle birthday timestamp conversion
        if (field === "birthday" && value && value.toDate) {
          value = value.toDate().toISOString().split("T")[0]; // Format as YYYY-MM-DD
        }
        
        return escapeCSV(value);
      });
      
      rows.push(row.join(","));
    });
    
    // Write to file
    const csvContent = rows.join("\n");
    fs.writeFileSync(outputPath, csvContent, "utf8");
    
    console.log(`✅ Successfully exported ${usersSnapshot.size} users to ${outputPath}`);
    console.log(`📊 Columns exported: ${fieldsToExport.length}`);
  } catch (error: any) {
    if (error.message?.includes("credentials") || error.message?.includes("authentication") || error.message?.includes("Could not load")) {
      console.error("\n❌ Authentication Error:");
      console.error("Firebase Admin SDK needs Application Default Credentials.");
      console.error("\nError details:", error.message);
      console.error("\nIf you've already run 'gcloud auth application-default login',");
      console.error("try setting the quota project:");
      console.error("  gcloud auth application-default set-quota-project campus-creator-club\n");
    } else {
      console.error("❌ Error exporting users:", error);
      console.error("Full error:", error);
    }
    process.exit(1);
  }
}

// Main execution
const outputFile = process.argv[2] || "users-export.csv";
const outputPath = path.isAbsolute(outputFile)
  ? outputFile
  : path.join(process.cwd(), outputFile);

console.log(`🚀 Starting user export...`);
console.log(`📁 Output file: ${outputPath}`);

exportUsersToCSV(outputPath)
  .then(() => {
    console.log("✨ Export completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Export failed:", error);
    process.exit(1);
  });

