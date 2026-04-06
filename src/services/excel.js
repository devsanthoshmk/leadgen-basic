import writeXlsxFile from 'write-excel-file/browser';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const SaveToDownloads = registerPlugin('SaveToDownloads');

const schema = [
  { column: 'Name', type: String, value: (row) => row.title, width: 30 },
  { column: 'Category', type: String, value: (row) => row.category, width: 20 },
  { column: 'No. Of Reviews', type: Number, value: (row) => row.reviews, width: 15 },
  { column: 'Stars', type: Number, value: (row) => row.stars, width: 10 },
  { column: 'Phone Number', type: String, value: (row) => row.completePhoneNumber, width: 20 },
  { column: 'Address', type: String, value: (row) => row.address, width: 60 },
  { column: 'Place Website', type: String, value: (row) => row.url || '', width: 50 },
];

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

let savedFileUri = null;

export function getLastSavedUri() {
  return savedFileUri;
}

export async function shareLastFile(filename) {
  if (!savedFileUri) return;
  await SaveToDownloads.shareFile({ uri: savedFileUri, filename });
}

export async function makeExcel(data, query) {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  const filename = `${query.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
  const blob = await writeXlsxFile(data, { schema });

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);

    // Save to Downloads using MediaStore API — no permissions needed on Android 10+
    const result = await SaveToDownloads.save({
      filename,
      data: base64,
    });

    savedFileUri = result.uri;

    // Send notification (non-critical — don't fail the export if notifications aren't enabled)
    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Download Complete',
              body: `${filename} saved to Downloads`,
              id: Date.now() % 2147483647,
              actionTypeId: 'DOWNLOAD_COMPLETE',
            },
          ],
        });
      }
    } catch (e) {
      console.warn('Could not send notification:', e.message);
    }

    return { uri: result.uri, filename };
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { filename };
  }
}
