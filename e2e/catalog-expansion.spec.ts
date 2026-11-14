import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { guidePath } from "../core/guide.mjs";
import { openCatalog } from "./catalog-helper";

const works = readdirSync("data/catalog")
  .filter((name) => name.endsWith(".route.json"))
  .map((name) => JSON.parse(readFileSync(`data/catalog/${name}`, "utf8")))
  .filter((pack) => pack.reviews.some((review: { date: string }) => review.date === "2026-11-12"));
const workCount = Object.keys(JSON.parse(readFileSync("src/gallery-metadata.json", "utf8"))).length;

for (const pack of works) {
  test(`${pack.game.id}: catalog, artwork, guide and prerequisites`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await openCatalog(page);
    const entry = page.getByRole("button", { name: `选择作品：${pack.game.title}`, exact: true });
    await entry.focus();
    await expect(page.locator(".disc-hit .disc-face")).toHaveAttribute("data-game-id", pack.game.id);
    const disc = page.locator(".disc-hit .disc-face img");
    await expect.poll(() => disc.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator(".disc-pagination .page-dot")).toHaveCount(Math.ceil(workCount / 8));
    await expect.poll(() => entry.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await entry.click();
    await expect(page.locator(".game-workspace h1")).toHaveText(pack.game.title);
    await expect(page.locator(".turntable")).toBeVisible();
    const route = pack.routes[0];
    await page.locator(".target-picker button").filter({ has: page.getByText(route.safeLabel, { exact: true }) }).click();
    await expect(page.locator(".tree-step")).toHaveCount(guidePath(pack, route.id).nodes.length);
    await expect(page.getByLabel("攻略使用条件")).toContainText("未实机");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: /^返回游戏库/ }).click();
    await expect(page.locator(".disc-hit .disc-face")).toHaveAttribute("data-game-id", pack.game.id);
    const gated = pack.routes.find((r: { requiredEndingIds: string[] }) => r.requiredEndingIds.length > 0);
    const direct = gated ?? route;
    await page.goto(`/guides/${pack.game.id}/${pack.id}/1/${direct.id}/`);
    await expect(page.locator(".tree-step")).toHaveCount(guidePath(pack, direct.id).nodes.length);
    if (gated) {
      const start = page.getByRole("button", { name: "开始记录进度", exact: true });
      await expect(start).toBeDisabled();
      await page.getByRole("checkbox", { name: /^我已完成/ }).check();
      await expect(start).toBeEnabled();
    }
    expect(errors).toEqual([]);
  });
}
