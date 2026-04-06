package in.mergex.leadgen;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import android.util.Base64;

@CapacitorPlugin(name = "SaveToDownloads")
public class SaveToDownloadsPlugin extends Plugin {

    @PluginMethod()
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        String base64Data = call.getString("data");

        if (filename == null || base64Data == null) {
            call.reject("filename and data are required");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            }

            Uri uri = getContext().getContentResolver().insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
            );

            if (uri == null) {
                call.reject("Failed to create file in Downloads");
                return;
            }

            OutputStream os = getContext().getContentResolver().openOutputStream(uri);
            if (os == null) {
                call.reject("Failed to open output stream");
                return;
            }
            os.write(bytes);
            os.flush();
            os.close();

            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            ret.put("path", Environment.DIRECTORY_DOWNLOADS + "/" + filename);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save file: " + e.getMessage(), e);
        }
    }

    @PluginMethod()
    public void openFile(PluginCall call) {
        String uriString = call.getString("uri");

        if (uriString == null) {
            call.reject("uri is required");
            return;
        }

        try {
            Uri uri = Uri.parse(uriString);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No app found to open this file: " + e.getMessage(), e);
        }
    }

    @PluginMethod()
    public void shareFile(PluginCall call) {
        String uriString = call.getString("uri");
        String filename = call.getString("filename", "file.xlsx");

        if (uriString == null) {
            call.reject("uri is required");
            return;
        }

        try {
            Uri uri = Uri.parse(uriString);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.putExtra(Intent.EXTRA_SUBJECT, filename);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(Intent.createChooser(intent, "Share " + filename));
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to share file: " + e.getMessage(), e);
        }
    }
}
