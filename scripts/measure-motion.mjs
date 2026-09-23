// Run against a production preview. Headless rAF cadence is a diagnostic, not device FPS.
// node scripts/measure-motion.mjs [--reference] [--hover] [http://127.0.0.1:4173]
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const local =
  process.argv.find((a) => /^https?:/.test(a)) || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : undefined,
});
const sites = [["archive", local, 2200]];
if (process.argv.includes("--reference"))
  sites.push(["reference", "https://a24.raviklaassens.com/", 21000]);
const results = [];
const hover = process.argv.includes("--hover");
await mkdir(".artifacts", { recursive: true });
try {
  for (const [site, url, settle] of sites) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(settle);
    await page.evaluate(() => {
      window.motionSample = { frames: [], longTasks: [], done: false };
      const observer = new PerformanceObserver((list) => {
        window.motionSample.longTasks.push(
          ...list.getEntries().map((e) => e.duration),
        );
      });
      observer.observe({ type: "longtask" });
      let last = performance.now();
      const end = last + 6000;
      const tick = (time) => {
        window.motionSample.frames.push(time - last);
        last = time;
        if (time < end) requestAnimationFrame(tick);
        else {
          window.motionSample.done = true;
          observer.disconnect();
        }
      };
      requestAnimationFrame(tick);
    });
    await page.mouse.move(800, 450);
    if (hover) {
      for (let i = 0; i < 32; i++) {
        await page.mouse.move(
          740 + Math.cos(i / 5) * 145,
          450 + Math.sin(i / 5) * 145,
        );
        await page.waitForTimeout(120);
      }
    } else {
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 110);
        await page.waitForTimeout(900);
      }
    }
    await page.waitForFunction(() => window.motionSample.done);
    const measurement = await page.evaluate(() => {
      const a = window.motionSample.frames.slice(1).sort((a, b) => a - b);
      return {
        samples: a.length,
        medianMs: +a[Math.floor(a.length * 0.5)].toFixed(2),
        p95Ms: +a[Math.floor(a.length * 0.95)].toFixed(2),
        intervalsOver33ms: a.filter((n) => n > 33.4).length,
        intervalsOver50ms: a.filter((n) => n > 50).length,
        longTasks: window.motionSample.longTasks,
      };
    });
    results.push({ site, ...measurement });
    await page.screenshot({
      path: `.artifacts/${hover ? "hover" : "motion"}-${site}.png`,
    });
    await page.close();
    console.log(site, measurement);
  }
  await writeFile(
    `.artifacts/${hover ? "hover" : "motion"}-measurements.json`,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        browser: browser.version(),
        viewport: "1440x900",
        method: hover
          ? "6s, pointer moving around disc, sequential, production preview"
          : "6s, five wheel gestures, sequential, production preview",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
