# Attendance Edge — GITAM Bengaluru

React Native attendance tracker for the Jun 29 – Nov 7, 2026 semester.

## Setup

**Prerequisites:** Node.js 18+, and either the Expo Go app (easiest) or Android Studio / Xcode.

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npx expo start
```

Then either:
- **Expo Go (easiest):** Install [Expo Go](https://expo.dev/client) on your phone, scan the QR code.
- **Android emulator:** Press `a` in the terminal after `expo start`.
- **iOS simulator:** Press `i` in the terminal (macOS only).

## How it works

- **Tap** a calendar date → opens the slot panel to toggle individual classes.
- **Long-press** a date → instantly marks all classes absent. Long-press again on a red day → marks all present.
- **All Present / All Absent** buttons in the slot panel for quick day-level control.
- **Auto-save:** Every change is written to AsyncStorage automatically — your data persists across app restarts.
- **Copy Code / Load Code:** Use these to back up or transfer your data.

## Data persistence

Uses `@react-native-async-storage/async-storage` — data survives app restarts indefinitely. No server, no account needed.

## Updating Sessional 2 dates

When you get your Sessional 2 exam dates, update this line in `App.js`:

```js
const S2_CUTOFF = null;   // e.g. change to '2026-10-15'
```

The eligibility gate card will automatically calculate once a date is set.
