# Campus Creator Club (CCC) - Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [User Roles & Authentication](#user-roles--authentication)
4. [App Architecture](#app-architecture)
5. [Ambassador System](#ambassador-system)
6. [Key Features & Implementation](#key-features--implementation)
7. [Database Structure](#database-structure)
8. [Account Management](#account-management)
9. [Setup & Installation](#setup--installation)
10. [Running the App](#running-the-app)
11. [Deployment](#deployment)
12. [Common Issues & Solutions](#common-issues--solutions)

## Overview

Campus Creator Club (CCC) is a React Native Expo application that connects campus content creators, manages ambassadors, and facilitates brand collaborations. The app supports three distinct user roles with separate interfaces and functionality.

### Tech Stack

- **Frontend**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Forms**: Formik with Yup validation
- **Language**: TypeScript

## Project Structure

```
CCC/
├── app/                          # Main application screens (Expo Router)
│   ├── (onboarding)/            # Authentication & onboarding flows
│   │   ├── index.tsx            # Landing/splash screen
│   │   ├── board-1.tsx          # Onboarding screen 1
│   │   ├── board-2.tsx          # Onboarding screen 2
│   │   ├── board-3.tsx          # Onboarding screen 3
│   │   ├── signin.tsx           # Main sign-in screen (email/phone/social)
│   │   ├── signup.tsx           # User registration screen
│   │   ├── admin-login.tsx      # Admin & Ambassador login with OAuth
│   │   ├── get-review.tsx       # Review/feedback collection
│   │   └── _layout.tsx          # Onboarding layout
│   │
│   ├── (user-tabs)/             # Regular user navigation tabs
│   │   ├── home/                # Home tab - announcements & profile
│   │   │   ├── index.tsx        # Home feed with announcements/webinars
│   │   │   ├── profile.tsx      # User profile management
│   │   │   ├── feedback.tsx     # User feedback form
│   │   │   └── _layout.tsx      # Home tab layout
│   │   ├── chat/                # Chat tab - messaging
│   │   │   ├── index.tsx        # General chat
│   │   │   ├── campaign-chat.tsx # Campaign-specific chats
│   │   │   ├── sub-chat.tsx     # Individual chat threads
│   │   │   └── _layout.tsx      # Chat tab layout
│   │   ├── campaign/            # Campaigns tab - browse & apply
│   │   │   ├── index.tsx        # Browse available campaigns
│   │   │   ├── details.tsx      # Campaign detail view
│   │   │   ├── campaign-chat.tsx # Campaign discussion
│   │   │   ├── sub-chat.tsx     # Campaign sub-chats
│   │   │   └── _layout.tsx      # Campaign tab layout
│   │   └── _layout.tsx          # User tabs layout
│   │
│   ├── (admin-tabs)/            # Admin navigation tabs
│   │   ├── home/                # Admin home - create content
│   │   │   ├── index.tsx        # Admin dashboard & content creation
│   │   │   ├── profile.tsx      # Admin profile management
│   │   │   ├── feedback.tsx     # Admin feedback form
│   │   │   └── _layout.tsx      # Admin home layout
│   │   ├── chat/                # Admin chat - messaging
│   │   │   ├── index.tsx        # General admin chat
│   │   │   ├── campaign-chat.tsx # Campaign management chats
│   │   │   ├── sub-chat.tsx     # Admin chat threads
│   │   │   └── _layout.tsx      # Admin chat layout
│   │   ├── campaign/            # Campaign management
│   │   │   ├── index.tsx        # Campaign overview & creation
│   │   │   ├── details.tsx      # Campaign management details
│   │   │   ├── campaign-chat.tsx # Campaign communication
│   │   │   ├── sub-chat.tsx     # Campaign sub-discussions
│   │   │   └── _layout.tsx      # Campaign management layout
│   │   └── _layout.tsx          # Admin tabs layout
│   │
│   ├── (ambassador-tabs)/       # Ambassador navigation tabs
│   │   ├── campaign-chat.tsx    # Assigned campaign communications
│   │   ├── campaign-details.tsx # View & manage assigned campaign
│   │   ├── profile.tsx          # Ambassador profile management
│   │   └── _layout.tsx          # Ambassador tabs layout
│   │
│   ├── index.tsx                # App entry point
│   ├── +not-found.tsx           # 404 error page
│   └── _layout.tsx              # Root app layout
│
├── services/                    # Business logic & API services
│   ├── accountService.ts        # Account management (soft deletion/recovery)
│   └── notificationService.tsx # Push notifications & messaging
│
├── components/                  # Reusable components
│   ├── ui/                      # UI components
│   ├── __tests__/               # Component tests
│   ├── Collapsible.tsx          # Collapsible content component
│   ├── ExternalLink.tsx         # External link handler
│   ├── HapticTab.tsx            # Haptic feedback tabs
│   ├── HelloWave.tsx            # Animation component
│   ├── NotificationSettings.tsx # Notification configuration
│   ├── ParallaxScrollView.tsx   # Parallax scroll component
│   ├── ThemedText.tsx           # Themed text component
│   └── ThemedView.tsx           # Themed view component
│
├── assets/                      # Static assets
│   ├── images/                  # App images & photos
│   ├── icons/                   # App icons & small graphics
│   ├── svgs/                    # SVG components & illustrations
│   └── fonts/                   # Custom fonts
│
├── validations/                 # Form validation schemas
│   └── signin-validation.js     # Sign-in form validation (Yup)
│
├── data/                        # Static data files
│   └── college-data.json        # University/college list (~3000 entries)
│
├── functions/                   # Firebase Cloud Functions
│   └── node_modules/            # Function dependencies
│
├── ios/                         # iOS native code & configuration
│   ├── CCC/                     # Main iOS app directory
│   ├── CCC.xcworkspace/         # Xcode workspace
│   └── CCC.xcodeproj/           # Xcode project
│
├── android/                     # Android native code & configuration
│
├── node_modules/                # NPM dependencies
│
├── GoogleService-Info.plist     # iOS Firebase configuration
├── google-services.json         # Android Firebase configuration
├── package.json                 # NPM package configuration
├── app.json                     # Expo app configuration
├── eas.json                     # EAS build configuration
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.js           # TailwindCSS configuration
├── nativewind-env.d.ts          # NativeWind type definitions
└── global.css                   # Global CSS styles
```

## User Roles & Authentication

### 1. Regular Users (Content Creators)

- **Access Path**: `/signin` → `/(user-tabs)/`
- **Features**: Apply for campaigns, track applications, share content links after acceptance, get notifications (new campaigns, webinars, announcements)
- **Authentication**: Email/Password, Phone OTP, Google Sign-in, Apple Sign-in
- **Profile Fields**: Username, university, bio, instagram, tiktok, profile photo.

### 2. Admins

- **Access Path**: `/admin-login` → `/(admin-tabs)/`
- **Features**: Create webinars, announcements, create/manage campaigns, full control.
- **Authentication**: Since the admins themselves usually undergo general phone auth so they can now direclty sign in through email/Password or oauth through they created account, and sign in from (admin-login.tsx).
- **Identification**: `role: "admin"` or `isAdmin: true` in Firestore

### 3. Ambassadors

- **Access Path**: `/admin-login` → `/(ambassador-tabs)/`
- **Features**: Manage assigned campaign chats, view/manage campaign details, coordinate with creators, set caps on how many can apply.
- **Authentication**: Email/Password or oauth by checking login as ambassador button (admin-login.tsx)
- **Identification**: `isAmbassador: true` in Firestore

### Authentication Flow

The authentication system uses Firebase Auth with multiple sign-in methods. When a user signs in:

1. **Deleted Account Check**: System first checks if the user exists in the deleted_users collection for account recovery
2. **Firestore Verification**: Verifies if user document exists in the active users collection
3. **Onboarding Status**: New users without completed onboarding are shown the onboarding modal
4. **Role-Based Routing**:
   - Admin login page checks for admin or ambassador roles
   - Regular sign-in page routes to user tabs
   - Invalid roles are denied access

## App Architecture

### Navigation Structure

The app uses Expo Router's file-based routing with three separate tab navigators:

1. **User Tabs** (`/(user-tabs)/_layout.tsx`)

   - Home (New webinars, announcements, and manage profile)
   - Chat (General messaging, can also switch between other chat groups which have been accepted into)
   - Campaigns (Browse and apply)

2. **Admin Tabs** (`/(admin-tabs)/_layout.tsx`)

   - Home (Create webinars, announcements, and manage profile)
   - Chat (General messaging, can also switch between any other chat groups)
   - Campaigns (Create, edit, manage, and assign ambassador)

3. **Ambassador Tabs** (`/(ambassador-tabs)/_layout.tsx`)
   - Campaign Chat (Assigned campaign communications)
   - Campaign Details (View assigned campaign,set caps, send notificaitons edit campaign details etc)
   - Profile (Standalone profile management)

### State Management

- **Authentication State**: Firebase Auth with `onAuthStateChanged` listeners
- **User Data**: Firestore real-time listeners with `onSnapshot`
- **Local State**: React hooks (useState, useEffect)
- **Form State**: Formik & Yup for forms

## Ambassador System

### How Ambassador Assignment Works

**Admin Creates Ambassador**:

- Admin navigates to the campaigns screen and assign existing users as ambassadors and assigns them any one of the campaign.
- System automatically sets the `isAmbassador` flag to true for the assigned user.
- Assigned user can now navigate to admin login screen check the login as ambassador button and proceed to sign in to get access to the assigned campaign, manage and edit.
- If not authorized, shows access denied.

### Ambassador Permissions

- View and manage applicants from their assigned campaign
- Manage campaign-specific chats and communications
- Can edit assigned campaign details
- Can set limit on how many can apply
- Cannot create system-wide campaigns (admin only)
- Cannot assign other ambassadors

## Key Features & Implementation

### 1. Social Authentication

**Google Sign-In**:
The app implements Google Sign-In through the React Native Google Sign-In library. The process involves:

- Checking for Play Services availability
- Initiating the sign-in flow
- Receiving Google credentials
- Authenticating with Firebase using the Google credential

**Apple Sign-In**:
Apple authentication is available for iOS users and follows Apple's guidelines:

- Requesting user authorization with name and email scopes
- Receiving Apple authentication response
- Creating Firebase credentials from Apple data
- Handling first-time name persistence for Apple users

### 2. Phone Authentication with OTP

The phone authentication system works in two steps:

- **OTP Generation**: User enters phone number, system sends verification code via SMS
- **OTP Verification**: User enters received code, system verifies and links phone to account
- Phone numbers are linked to existing accounts to prevent duplicate registrations

### 3. Campaign Management System

**Admin Campaign Creation**:

- Admins create campaigns with detailed requirements and deadlines
- Set participation criteria and rewards
- Track applications and approve participants

**User Campaign Participation**:

- Users browse available campaigns in their campaigns tab
- Apply for campaigns that match their profile and eligibility crieteria
- Upon acceptance, create content and submit links
- Track application status.

### 4. Content Sharing & Feed

**Content Submission**:

- Accepted campaign participants share content links (Instagram, TikTok, etc.)
- And can enter campaign level sub chats which they got accepted into.
- Links are validated and checked.
- Admins review submissions for compliance

**Feed System**:

- Home feed displays announcements and updates
- Campaign announcements and webinar notifications
- Real-time updates using Firestore listeners

## Database Structure

### Firestore Collections

**users collection**:
Stores all user data including regular users, admins, and ambassadors. Key fields include:

- Basic info: uid, name, email, phoneNumber, username
- Profile data: university, bio, instagram, tiktok, photoUrl
- Role flags: isAdmin, isAmbassador, role
- Status: hasCompletedOnboarding, createdAt

**deleted_users collection**:
Maintains soft-deleted accounts for 30-day recovery period:

- Contains all original user data
- Additional fields: deletedAt timestamp, originalUserId
- Automatically cleaned up after 30 days.

**campaigns collection**:
Stores all campaign information:

- Campaign details: title, description, requirements, deadline
- Management: createdBy, status, reward
- Participation: applicants list, accepted participants, submissions

**announcements collection**:
Admin-created announcements:

- Type: announcement, general post
- Content: title, content, imageUrl
- Engagement: views, attendees (for webinars)

**webinars collection**:
Admin-created webinars:

- Type: webinars,
- Content: title, link, platform, startTime
- Engagement: no of attendees (for webinars)

**chats collection**:
Message threads for different chat types:

- General chat messages
- Campaign-specific discussions
- Participants list and permissions
- Message history with timestamps

## Account Management

### Soft Deletion System

The app implements a soft deletion system where accounts are deactivated for 30 days before permanent deletion.

**How It Works**:

1. **Account Deactivation Process**:

   - User initiates account deletion from profile settings
   - System moves user data from `users` collection to `deleted_users` collection
   - Adds deletion timestamp for tracking 30-day period
   - User is signed out but Firebase Auth record remains

2. **Recovery Mechanism**:

   - When deactivated user attempts to sign in within 30 days
   - System detects account in `deleted_users` collection
   - Prompts user with recovery option
   - If accepted, restores data back to `users` collection

3. **Permanent Deletion**:
   - After 30 days, a cloud function will:
   - Remove data from `deleted_users` collection
   - Delete Firebase Auth record
   - Clean up any associated user content

### Account Recovery Flow

1. User deactivates account → Data moved to `deleted_users`
2. User signs in within 30 days → Recovery prompt appears
3. User confirms recovery → Data restored to `users` collection
4. After 30 days → Cloud Function permanently deletes (to be implemented)

## Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- For iOS: Xcode 14+ and macOS to run on a simulator
- For Android: Android Studio for emulator or a physical device with usb debugging turned on.

### Environment Setup

1. **Clone the repository**:

```bash
git clone [repository-url]
cd CCC
```

2. **Install dependencies**:

```bash
npm install

3. **Firebase Configuration**:

Since the app uses `react-native-firebase`, the configuration is handled automatically through the native configuration files:

- **iOS**: `GoogleService-Info.plist` (already in `ios/CCC/` directory)
- **Android**: `google-services.json` (already in `android/app/` directory)

No additional JavaScript configuration file is needed as `react-native-firebase` reads the configuration directly from these native files.
```

## Running the App

### Development Mode

**iOS Simulator**:

```bash
npx expo run:ios
# or for specific device
npx expo run:ios --device (and choose a device)
```

**Android Emulator**:

```bash
npx expo run:android
# or for specific device
npx expo run:android --device (and choose a device)
```

### Development Builds

**Create development build**:

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

### Production Builds

**iOS Production**:

```bash
eas build --profile production --platform ios
eas submit -p ios
```

**Android Production**:

```bash
eas build --profile production --platform android
eas submit -p android
```

## Deployment

### Firebase Security Rules

**Key Security Principles**:

- Users can only read/write their own user data
- Admins have elevated permissions for user management
- Ambassadors have limited admin permissions for their assign campaign
- Deleted users collection allows recovery by original user
- Campaign applications are user-specific
- Public read for announcements, authenticated write for admins

**Rule Categories**:

1. **User Data**: Authenticated users can modify only their profile
2. **Admin Operations**: Full CRUD on users, campaigns, announcements
3. **Ambassador Access**: Limited to assigned campaigns
4. **Public Content**: Announcements readable by all authenticated users

### Cloud Functions

**Automated Account Cleanup**:

- Runs once every 3 days to check deleted_users collection
- Permanently removes accounts older than 30 days
- Deletes associated Firebase Auth records

## Common Issues & Solutions

### iOS Build Failures

**Common fixes**:

- Clean pod cache and reinstall dependencies
- Ensure all required capabilities are enabled in Xcode
- Verify provisioning profiles and certificates

## Testing

### Manual Testing Checklist

**Authentication Flow**:

- [ ] Regular user sign-up with email/password
- [ ] Phone OTP verification
- [ ] Google Sign-In
- [ ] Apple Sign-In (iOS only)
- [ ] Admin login
- [ ] Ambassador login
- [ ] Account deactivation
- [ ] Account recovery

**Core Features**:

- [ ] Apply for campaigns
- [ ] Submit content links
- [ ] View announcements feed
- [ ] Browse campaigns
- [ ] Update profile
- [ ] Announcement,webinar,campaign notifications
- [ ] Admin create campaigns
- [ ] Admin post announcements
- [ ] Admin assign ambassador
- [ ] Ambassador manage campaign

### Contact

For technical support or questions about this codebase, refer to the repository issues or contact the development team.

---

_Last Updated: September 2025_
_Version: 1.0.39_

```

```
