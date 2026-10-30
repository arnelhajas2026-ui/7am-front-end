import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Build ID kada build — ginagamit para ma-detect kung may bagong frontend version.
// Naka-embed sa app (__APP_VERSION__) at nilalabas din bilang /version.json.
const BUILD_ID = String(Date.now());

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: BUILD_ID }) });
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(BUILD_ID) },
  server: { port: 5173 },
});
