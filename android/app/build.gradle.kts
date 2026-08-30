plugins {
    id("com.android.application")
}

android {
    namespace = "com.todijo.marketplace"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.todijo.marketplace"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0-stage1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.6.2")
}
