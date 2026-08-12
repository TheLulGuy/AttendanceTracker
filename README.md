# Attendance Edge

Current version: v1.3.0

React Native attendance tracker for college, universally implemented for all college time tables

## Features

- **Universal timetable** - The user can update the timetable in a flexible manner from timeslots to name and description
- **Examination dates and Holiday tracker** - You can track your attendance upto your exam dates, accomodating for holidays as well
- **Clean UI** - easy to use UI with color coded references for all types of information

## How it works

- **Tap** a calendar date → opens the slot panel to toggle individual classes.
- **Long-press** a date → instantly marks all classes absent. Long-press again on a red day → marks all present.
- **All Present / All Absent** buttons in the slot panel for quick day-level control.
- **Auto-save:** Every change is written to AsyncStorage automatically — your data persists across app restarts.
- **Copy Code / Load Code:** Use these to back up or transfer your data.

## Data persistence

Sign in with email/password to use the app. Data is saved locally (`@react-native-async-storage/async-storage`) and synced to your account via Firebase, so it carries over across devices.

