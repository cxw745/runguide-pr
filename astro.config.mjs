import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://runguide-flame.vercel.app',
  prefetch: {
    prefetchAll: true,
  },
});
