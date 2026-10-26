package io.github.bearbabybaby_ai.penghubear;

import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.webkit.WebView;
import androidx.annotation.RequiresApi;
import com.getcapacitor.BridgeActivity;

/**
 * 熊熊澎湖之旅 原生 App：畫面就是正式網址的遊戲（capacitor.config.json 的 server.url）。
 * 開著「我的位置」時（遊戲呼叫 NavPip.setEnabled），按回桌面會縮成子母畫面，像 Google 地圖導航一樣繼續顯示。
 */
public class MainActivity extends BridgeActivity {
    static volatile boolean pipAllowed = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NavPipPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @RequiresApi(26)
    static PictureInPictureParams pipParams(boolean autoEnter) {
        PictureInPictureParams.Builder b = new PictureInPictureParams.Builder().setAspectRatio(new Rational(3, 4));
        if (Build.VERSION.SDK_INT >= 31) b.setAutoEnterEnabled(autoEnter).setSeamlessResizeEnabled(true);
        return b.build();
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Android 12 以上由系統自動進入（setAutoEnterEnabled）；舊版在按回桌面時手動進入
        if (pipAllowed && Build.VERSION.SDK_INT >= 26 && Build.VERSION.SDK_INT < 31) {
            try { enterPictureInPictureMode(pipParams(false)); } catch (Exception ignored) { }
        }
    }

    @RequiresApi(26)
    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration newConfig) {
        super.onPictureInPictureModeChanged(inPip, newConfig);
        try {
            WebView web = getBridge().getWebView();
            web.evaluateJavascript("document.documentElement.classList.toggle('pip'," + inPip + ");window.dispatchEvent(new Event('pipchange'))", null);
        } catch (Exception ignored) { }
    }
}
