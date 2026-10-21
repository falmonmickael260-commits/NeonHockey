import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    host: true,
    // Railway (and most PaaS) front the app behind a generated domain —
    // Vite's preview server rejects unknown Host headers by default.
    allowedHosts: true,
  },
});
