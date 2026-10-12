import type { Page } from "@playwright/test";

// Catalog tools are available from the home shelf.
export async function openCatalog(page: Page) {
  if (
    await page
      .getByRole("dialog", { name: "作品目录", exact: true })
      .isVisible()
  )
    return;
  if (!(await page.locator('.app-shell[data-view="library"]').count())) {
    await page.getByRole("button", { name: /^我的游戏库/ }).click();
  }
  await page.getByRole("button", { name: "作品目录", exact: true }).click();
}
