package org.ihsanacademy.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import androidx.browser.customtabs.CustomTabsIntent;

public final class MainActivity extends Activity {
    private static final String ACADEMY_URL = "https://ihsan-academy.pages.dev/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri uri = Uri.parse(ACADEMY_URL);
        try {
            CustomTabsIntent tabs = new CustomTabsIntent.Builder()
                    .setShowTitle(true)
                    .setToolbarColor(Color.rgb(6, 78, 59))
                    .setUrlBarHidingEnabled(true)
                    .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
                    .build();
            tabs.launchUrl(this, uri);
        } catch (Exception error) {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        }
        finish();
    }
}
