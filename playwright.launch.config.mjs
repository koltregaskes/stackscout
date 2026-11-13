import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/launch',testMatch:'launch.spec.mjs',globalTimeout:280000,fullyParallel:true,workers:4,retries:0,timeout:45000,use:{browserName:'chromium',channel:process.env.PLAYWRIGHT_CHANNEL,serviceWorkers:'block',reducedMotion:'reduce'},reporter:'list'});
