package io.github.bearbabybaby_ai.penghubear;

import android.app.Activity;
import android.os.Build;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 遊戲開／關「我的位置」時呼叫：允許子母畫面、螢幕保持亮著。 */
@CapacitorPlugin(name = "NavPip")
public class NavPipPlugin extends Plugin {
    @PluginMethod
    public void setEnabled(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        final Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            MainActivity.pipAllowed = on;
            try {
                if (Build.VERSION.SDK_INT >= 26) activity.setPictureInPictureParams(MainActivity.pipParams(on));
            } catch (Exception ignored) { }
            if (on) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }
}
