import { test, expect } from "@playwright/test";
import { openCatalog } from "./catalog-helper";

for (const work of [
  { id: "lunaria", title: "LUNARiA -Virtualized Moonchild-", pack: "lunaria-steam-pc" },
  { id: "christmas-tina", title: "Christmas Tina -泡沫冬景-", pack: "christmas-tina-pc" },
]) {
  test(`${work.id} artwork, title, pagination and guide stay usable`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await openCatalog(page);
    const entry = page.getByRole("button", { name: `选择作品：${work.title}`, exact: true });
    await entry.focus();
    await expect(page.locator(".disc-hit .disc-face")).toHaveAttribute("data-game-id", work.id);
    await expect(page.locator(".disc-pagination .page-dot")).toHaveCount(3);
    await expect(entry.locator("img")).toHaveJSProperty("complete", true);
    expect(await entry.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await entry.click();
    await expect(page.locator(".game-workspace h1")).toHaveText(work.title);
    await expect(page.locator(".turntable")).toBeVisible();
    await page.getByRole("button", { name: /^本篇 ·/ }).click();
    await expect(page.locator(".tree-step")).toHaveCount(2);
    await expect(page.getByLabel("攻略使用条件")).toContainText("未实机");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    await page.goto(`/guides/${work.id}/${work.pack}/1/main/`);
    await expect(page.locator(".tree-step")).toHaveCount(2);
  });
}
