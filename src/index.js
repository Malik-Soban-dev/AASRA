/**
 * AASRA — Worker entry point (Cloudflare Workers with static assets).
 *
 * The /api/* Pages-Functions tree in functions/ is compiled at build time
 * (`npm run build` → `wrangler pages functions build`) into dist-worker/index.js.
 * That compiled router dispatches /api/* requests exactly like Cloudflare Pages
 * would (including functions/api/_middleware.js) and falls back to the ASSETS
 * binding (dist/) for every non-API route.
 *
 * This entry re-exports that fetch handler and adds the cron `scheduled`
 * handler — Workers support Cron Triggers (Pages did not), configured in
 * wrangler.toml [triggers].
 */

// @ts-ignore — dist-worker/index.js is generated at build time
import functionsRouter from '../dist-worker/index.js';
import { onRequestScheduled } from '../functions/scheduled.js';

export default {
  async fetch(request, env, ctx) {
    return functionsRouter.fetch(request, env, ctx);
  },

  /**
   * Cron entry: adapts the Workers scheduled(controller, env, ctx) signature
   * to the Pages-style onRequestScheduled(context) used in functions/scheduled.js.
   */
  async scheduled(controller, env, ctx) {
    const context = {
      request: new Request('https://aasra.shop/api/__cron__', { method: 'POST' }),
      env,
      params: {},
      data: {},
      waitUntil: (promise) => ctx.waitUntil(promise),
      next: () => Promise.resolve(new Response(null, { status: 204 })),
    };
    return onRequestScheduled(context);
  },
};
