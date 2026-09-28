package com.todijo.marketplace;

import android.widget.ImageView;

import androidx.annotation.NonNull;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

public final class TodijoLauncherActivity extends LauncherActivity {
    @NonNull
    @Override
    protected ImageView.ScaleType getSplashImageScaleType() {
        return ImageView.ScaleType.FIT_CENTER;
    }
}
