# Phase 21 — Mobile Strategy (React Native)

> **Tier 4 feature. Do not begin mobile development until the web product and API are stable.**

---

## Development Rule

> Mobile development begins only after:
> 1. The web MVP (Phases 0–11) is live and validated with real users.
> 2. The REST API has been stable through at least one full product cycle.
> 3. The shared TypeScript package (`packages/shared`) is defined and tested against the web client.

Building web + Android + iOS simultaneously would triple QA, triple bug surface, and delay all three. Ship web first.

---

## Goal

Deliver a React Native companion app that shares core logic with the web frontend, enables push notifications for breach alerts, and allows native app launching from the account dashboard — without duplicating business logic.

---

## Why React Native (Not Flutter or Native)

| Criterion | React Native | Flutter | Native |
|---|---|---|---|
| Code sharing with web | ✅ Hooks, types, API client, stores | ❌ None (Dart) | ❌ None |
| Team expertise fit | ✅ Same TypeScript/React skills | ❌ New language | ❌ Two separate teams |
| OTA updates (JS only) | ✅ Expo EAS Update | ✅ | ❌ Store review required |
| Deep link + app detection | ✅ expo-linking | ✅ | ✅ |
| Time to ship | ✅ Fastest | ✅ Fast | ❌ Slowest |

**Decision:** React Native + Expo (Bare Workflow) + TypeScript.

---

## Monorepo Structure (Code Sharing)

```
mylogin/
├── packages/
│   ├── shared/                   ← Shared across web + mobile
│   │   ├── api/
│   │   │   ├── client.ts         ← axios/fetch client
│   │   │   ├── accounts.ts
│   │   │   ├── auth.ts
│   │   │   └── security.ts
│   │   ├── store/
│   │   │   ├── authStore.ts      ← Zustand
│   │   │   └── accountStore.ts
│   │   └── types/
│   │       ├── account.ts
│   │       └── user.ts
│   │
│   ├── web/                      ← React + Vite (built first)
│   └── mobile/                   ← React Native + Expo (built after web is stable)
│
└── backend/                      ← Express + Node.js
```

**Shared between web and mobile:** API client, TypeScript types, Zustand stores, utility functions.
**Not shared:** UI components, navigation, platform APIs.

---

## Features

### 1. Authentication
- Login with Google via `expo-auth-session`
- Email/password login via API
- Tokens stored in `expo-secure-store` (Keychain/Keystore — never AsyncStorage)

### 2. Account Dashboard
- Same account list and filtering as web
- Swipe left on card → Quick actions (Archive, Mark Deleted)
- Pull-to-refresh → triggers Gmail scan

### 3. Native App Launching
```typescript
async function launchService(service: Service) {
  const deepLink = Platform.OS === 'android'
    ? service.android_deep_link
    : service.ios_deep_link;

  if (deepLink) {
    const canOpen = await Linking.canOpenURL(deepLink);
    if (canOpen) {
      await Linking.openURL(deepLink);
      return;
    }
  }
  await Linking.openURL(service.login_url ?? service.website_url);
}
```

### 4. Push Notifications
- Android: Firebase Cloud Messaging (FCM)
- iOS: Apple Push Notification service (APNs)
- Handled via `expo-notifications`

```typescript
async function registerForPush() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: EAS_PROJECT_ID
  })).data;
  await api.post('/api/v1/notifications/push-subscription', {
    token, platform: Platform.OS
  });
}
```

### 5. Biometric Authentication
- Face ID / Touch ID for quick re-auth
- `expo-local-authentication`

### 6. Secure Token Storage
```typescript
// CORRECT — encrypted storage
await SecureStore.setItemAsync('access_token', token);

// WRONG — never use AsyncStorage for tokens (plain text)
// await AsyncStorage.setItem('access_token', token);
```

---

## Navigation Architecture

```
Bottom Tab Navigator
├── 🏠 Dashboard      (AccountListScreen)
├── 🛡️  Security       (SecurityCenterScreen)
├── 🧹 Cleanup        (AccountCleanupScreen)
└── 👤 Profile        (ProfileScreen)
     └── Settings    (SettingsScreen)   ← Stack push

Modal Screens
├── AccountDetailModal
├── GmailConnectModal
└── BreachAlertModal
```

---

## Deployment Pipeline

```bash
# Development
npx expo start
npx expo run:android
npx expo run:ios

# Production build
eas build --platform android --profile production
eas build --platform ios --profile production

# OTA update (JS changes only, no store review)
eas update --branch production --message "Hotfix description"
```

---

## Deployment Roadmap

| Phase | Target | When |
|---|---|---|
| Internal testing | TestFlight + Play Store Internal | After web MVP stable |
| Android open beta | Google Play Store | +4 weeks |
| iOS App Store | Submission + Apple review | +6 weeks |
| Full public launch | Both stores | +8 weeks |

---

## App Store Considerations

- **Apple In-App Purchases**: If subscription is offered via App Store, Apple takes 30% (15% after year 1). Direct users to the web for subscription management to avoid this.
- **Privacy Manifest**: Apple requires declaring data usage — must declare Gmail metadata scanning clearly.
- **Gmail on iOS**: App Privacy section must accurately describe Gmail data use.

---

## What Is NOT in Phase 21

```
❌ Simultaneous web + mobile development (web ships first)
❌ Mobile-specific backend endpoints (all endpoints are shared)
❌ React Native before API stability
❌ Flutter alternative implementation
❌ Cordova / Ionic / Capacitor
❌ Local password audit on mobile (complex WebWorker equivalent)
❌ Advanced ML features on mobile
```

---

## Performance Targets

| Metric | Target |
|---|---|
| App cold start | ≤ 2 seconds |
| Dashboard initial render | ≤ 1.5 seconds |
| Scroll frame rate | 60 fps |
| Push notification delivery | ≤ 10 seconds from trigger |
| APK size | ≤ 20MB |
| IPA size | ≤ 25MB |

---

## Acceptance Criteria

- [ ] `packages/shared` API client and stores work on both web and mobile without duplication.
- [ ] Auth tokens stored in `expo-secure-store` exclusively (never AsyncStorage).
- [ ] Push notification registration completes for both FCM (Android) and APNs (iOS).
- [ ] Native app launch via `Linking.openURL` correctly opens installed apps by deep link.
- [ ] Swipe-left gesture reveals quick action buttons on account cards.
- [ ] Pull-to-refresh triggers Gmail scan API call.
- [ ] EAS Build produces working AAB and IPA.
- [ ] OTA update delivers to installed device within 30 seconds of `eas update`.
- [ ] Mobile development does not begin until web MVP (Phases 0–11) is live and stable.
