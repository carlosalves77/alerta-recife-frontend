import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [vue()],
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        },
        mangle: {
          toplevel: true
        }
      }
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_API,
          changeOrigin: true
        },
        '/oauth2': {
          target: env.VITE_BACKEND_API,
          changeOrigin: true
        }
      }
    }
  }
})
