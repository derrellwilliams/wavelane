#!/bin/sh
# Builds the tablet's debug APK: android/app/build/outputs/apk/debug/app-debug.apk
# Needs JDK 21 and the Android SDK (platform 36, build-tools 36.0.0); see docs/PLAN.md.
# The APK holds the Letterboxd export (src/letterboxd/seed.local.ts): never share it.
set -e
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.cache/android-sdk}"
# The debug signing key lives here, so every build (Claude's sandbox or your own Terminal) signs
# the same way and `adb install -r` can update the app without wiping its data.
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-$HOME/.cache/android-user}"
export PATH="$JAVA_HOME/bin:$PATH"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
npm run build:android
cd android
./gradlew assembleDebug --console=plain
echo "APK: $(pwd)/app/build/outputs/apk/debug/app-debug.apk"
