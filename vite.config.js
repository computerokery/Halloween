import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // demo videos and the asset cache are not part of the app; don't watch them
    watch: { ignored: ['**/demo/**', '**/tools/.cache/**', '**/home_screen_design/**'] },
  },
});
