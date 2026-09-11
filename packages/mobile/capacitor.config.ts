import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tastefull.app',
  appName: 'Tastefull',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      backgroundColor: '#faf8f5',
      launchAutoHide: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  // server: {
  //   // Live reload: point to Vite dev server on host machine
  //   // Android emulator uses 10.0.2.2 to reach host; iOS simulator uses localhost
  //   url: 'http://10.0.2.2:5174',
  //   cleartext: true,
  // },
}

export default config
