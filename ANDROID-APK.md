# Android APK build

This branch packages the existing Cloudflare-hosted Ihsan Academy as an Android app using Capacitor. The app loads the production web app at `https://ihsan-academy.pages.dev/`; school records and API remain on Cloudflare.

## Build

GitHub Actions workflow: `.github/workflows/android-apk.yml`.

Open the repository Actions tab, select **Build Ihsan Academy Android APK**, and download the `ihsan-academy-android-apk` artifact after a successful run. The artifact contains a debug APK for installation/testing; it is not a Play Store-signed release.

A network connection is required to use the remotely hosted academy. The APK does not contain a copy of the school database.
