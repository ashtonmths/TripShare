# TripShare Java for Android

This is a separate native Android Views app written in Java. It uses XML layouts,
Gradle Kotlin DSL, the existing TripShare tRPC endpoints, and the existing Better
Auth Google sign-in. It is not a WebView or an Expo build. The package ID is
`app.tripshare.java`, so it can be installed alongside the Expo app.

Open `apps/android-java` in Android Studio and let it install Android SDK 35.
Use JDK 17. To build an installable debug APK:

```sh
./gradlew :app:assembleDebug
```

On Windows use `gradlew.bat :app:assembleDebug`. The APK is at
`app/build/outputs/apk/debug/app-debug.apk`. For a release APK, create your own
signing key in Android Studio and use **Build > Generate Signed App Bundle / APK**.
Do not commit the keystore or its passwords.

`API_BASE_URL` is defined in `app/build.gradle.kts`. It currently points at
`https://tripshare.ashtonmths.dev`. The backend must be deployed with
`tripsharejava://` in Better Auth trusted origins before Google sign-in works.
The Java app receives the Google OAuth result through `tripsharejava://auth`
and stores the session cookie encrypted with Android Keystore.

The native UI supports Google sign-in, home balances and approvals, owned and
shared trips, trip settings, people, journey history, different outward/return
passengers, attendance corrections, payment claims, manual payments, fuel price
lookup with manual fallback, and the live cost preview. Partners cannot use
owner-only mutations. The backend still enforces ownership and membership.

The Java app does not use Expo Updates; changes to Java/XML require a new APK.
The Expo app remains separate and retains its own OTA updates.
