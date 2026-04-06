import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.mergex.leadgen',
  appName: 'Mergex LeadGen',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#E8FF00',
    },
  },
};

export default config;
