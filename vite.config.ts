import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  return {
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ and adds GitHub Pages SPA helpers (.nojekyll + 404.html)
      {
        name: 'copy-unbundled-src-assets-and-gh-pages',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
          if (fs.existsSync(distDir)) {
            const nojekyllPath = path.join(distDir, '.nojekyll');
            if (!fs.existsSync(nojekyllPath)) {
              fs.writeFileSync(nojekyllPath, '');
            }
            const indexHtmlPath = path.join(distDir, 'index.html');
            const notFoundPath = path.join(distDir, '404.html');
            if (fs.existsSync(indexHtmlPath)) {
              fs.copyFileSync(indexHtmlPath, notFoundPath);
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
