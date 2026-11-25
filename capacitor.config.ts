import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'app.voxly.messenger',
  appName: 'Voxly',
  webDir: 'dist',
  server: { androidScheme: 'https' }
}
export default config