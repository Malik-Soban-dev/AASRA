import { defineConfig } from 'astro/config';

export default defineConfig({
  // Static output for Cloudflare Pages
  output: 'static',
  root: '.',
  public: 'public',
});
