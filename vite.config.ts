import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Locally declare process to bypass missing global node types during build
declare var process: {
  env: {
    API_KEY?: string;
  };
};

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
