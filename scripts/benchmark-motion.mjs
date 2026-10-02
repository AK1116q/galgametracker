import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : undefined,
});
const results = [];
for (const rate of [1, 4]) {
  const page = await browser.newPage({
    viewport: { width: rate === 1 ? 1440 : 390, height: 900 },
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await cdp.send("Performance.enable");
  await page.goto("http://127.0.0.1:4173");
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    window.__frames = [];
    window.__writes = 0;
    let last = performance.now();
    window.__run = true;
    function tick(t) {
      window.__frames.push(t - last);
      last = t;
      if (window.__run) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    window.__observer = new MutationObserver(
      (m) => (window.__writes += m.length),
    );
    window.__observer.observe(document.querySelector(".disc-scene"), {
      attributes: true,
      subtree: true,
    });
  });
  const before = await cdp.send("Performance.getMetrics");
  const box = await page.locator(".disc-hit").boundingBox();
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(
      box.x + box.width * (0.35 + 0.25 * Math.sin(i)),
      box.y + box.height * (0.35 + 0.25 * Math.cos(i)),
    );
    await page.waitForTimeout(35);
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1000);
  const after = await cdp.send("Performance.getMetrics");
  const sample = await page.evaluate(() => {
    window.__run = false;
    window.__observer.disconnect();
    const f = window.__frames.slice(1).sort((a, b) => a - b);
    return {
      p95ms: f[Math.floor(f.length * 0.95)],
      over34ms: f.filter((x) => x > 34).length,
      frames: f.length,
      attributeWrites: window.__writes,
    };
  });
  const metrics = {};
  for (const name of ["TaskDuration", "LayoutDuration", "RecalcStyleDuration"])
    metrics[name] =
      after.metrics.find((m) => m.name === name).value -
      before.metrics.find((m) => m.name === name).value;
  results.push({ cpuRate: rate, ...sample, ...metrics });
  await page.close();
}
await browser.close();
if (process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
console.log(results);
