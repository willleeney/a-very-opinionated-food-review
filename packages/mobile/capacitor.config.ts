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
  server: {
    // Use this during development to proxy to Vite dev server
    // url: 'http://localhost:5173',
    // cleartext: true,
  },
}

export default config
