import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openCatalog } from "./catalog-helper";

const workCount = Object.keys(JSON.parse(readFileSync("src/gallery-metadata.json", "utf8"))).length;

for (const work of [
  { id: "nekopara-vol-0", title: "NEKOPARA Vol. 0", pack: "nekopara-vol-0-pc", route: /^Vol\. 0 本篇/ },
  { id: "fault-milestone-two", title: "fault - milestone two side:above", pack: "fault-milestone-two-pc", route: /^side:above 本篇/ },
]) {
  test(`${work.id} cover, long-title layout, pagination and guide`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await openCatalog(page);
    const entry = page.getByRole("button", { name: `选择作品：${work.title}`, exact: true });
    await entry.focus();
    await expect(page.locator(".disc-hit .disc-face")).toHaveAttribute("data-game-id", work.id);
    const disc = page.locator(".disc-hit .disc-face img");
    await expect(disc).toHaveJSProperty("complete", true);
    expect(await disc.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator(".disc-pagination .page-dot")).toHaveCount(Math.ceil(workCount / 8));
    const cover = entry.locator("img");
    await expect(cover).toHaveJSProperty("complete", true);
    expect(await cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await entry.click();
    await expect(page.locator(".game-workspace h1")).toHaveText(work.title);
    await expect(page.locator(".turntable")).toBeVisible();
    await page.getByRole("button", { name: work.route }).click();
    await expect(page.locator(".tree-step")).toHaveCount(2);
    await expect(page.getByLabel("攻略使用条件")).toContainText("未实机");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    await page.goto(`/guides/${work.id}/${work.pack}/1/main/`);
    await expect(page.locator(".tree-step")).toHaveCount(2);
  });
}
