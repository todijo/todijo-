plugins {
    id("com.android.application")
}

fun releaseValue(name: String): String? =
    providers.gradleProperty(name).orNull ?: providers.environmentVariable(name).orNull

val uploadStoreFile = releaseValue("TODIJO_UPLOAD_STORE_FILE")
val uploadStorePassword = releaseValue("TODIJO_UPLOAD_STORE_PASSWORD")
val uploadKeyAlias = releaseValue("TODIJO_UPLOAD_KEY_ALIAS")
val uploadKeyPassword = releaseValue("TODIJO_UPLOAD_KEY_PASSWORD")
val releaseSigningConfigured = listOf(uploadStoreFile, uploadStorePassword, uploadKeyAlias, uploadKeyPassword).all { !it.isNullOrBlank() }

android {
    namespace = "com.todijo.marketplace"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.todijo.marketplace"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("release") {
                storeFile = file(uploadStoreFile!!)
                storePassword = uploadStorePassword
                keyAlias = uploadKeyAlias
                keyPassword = uploadKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isDebuggable = false
            if (releaseSigningConfigured) signingConfig = signingConfigs.getByName("release")
        }
    }
}

tasks.matching { it.name == "bundleRelease" }.configureEach {
    doFirst {
        check(releaseSigningConfigured) {
            "Release signing is not configured. Provide all four TODIJO_UPLOAD_* values outside source control."
        }
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.6.2")
}
