import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'ksa-leidingsapp',
  webDir: 'dist',
  ios: {
    // Lock the native WebView background so it never shows white during layout init
    backgroundColor: '#0f172a',
    scrollEnabled: false,
    allowsLinkPreview: false,
  },
  plugins: {
    // Remove any default plugin overrides here if needed
  }
};

export default config;
