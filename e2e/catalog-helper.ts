import type { Page } from "@playwright/test";

// The quiet home shelf has no header navigation; catalog tools live inside a work.
export async function openCatalog(page: Page) {
  if (
    await page
      .getByRole("dialog", { name: "作品目录", exact: true })
      .isVisible()
  )
    return;
  if (await page.locator('.app-shell[data-view="library"]').count()) {
    await page.getByRole("button", { name: /查看攻略/ }).click();
  }
  await page.getByRole("button", { name: "作品目录", exact: true }).click();
}
