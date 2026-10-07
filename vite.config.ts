import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error plain JS module, shared with any future standalone server
import { createApi } from './server/api.mjs';

/** Serves /api/* from the SQLite database, in both `vite` and `vite preview`. */
function chronoscopeApi(): Plugin {
  return {
    name: 'chronoscope-api',
    configureServer(server) {
      server.middlewares.use(createApi());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createApi());
    },
  };
}

export default defineConfig({
  plugins: [react(), chronoscopeApi()],
  server: { port: 5173 },
});
