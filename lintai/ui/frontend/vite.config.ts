import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// ts-ignore

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
  },
})
