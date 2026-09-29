plugins {
    id("com.android.application")
}

android {
    namespace = "app.tripshare.java"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.tripshare.java"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.1.2-java"
        buildConfigField("String", "API_BASE_URL", "\"https://tripshare.ashtonmths.dev\"")
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.browser:browser:1.8.0")
}
