import { test, expect } from "@playwright/test";

test("disc keyboard navigation, direct opening, search and return remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const stage = page.getByLabel("光盘浏览，左右方向键切换作品，回车查看攻略", {
    exact: true,
  });
  await stage.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: /^True Ending/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
  await page.getByLabel("搜索游戏").fill("千恋");
  await expect(page.locator(".disc-info h2")).toHaveText("千恋＊万花");
  await expect(page.getByRole("button", { name: "下一部作品" })).toBeDisabled();
  await page.getByRole("button", { name: "打开当前光盘：千恋＊万花" }).click();
  await expect(page.getByRole("button", { name: /^常陆茉子/ })).toBeVisible();
});

test("small wheel deltas accumulate once per gesture; dragging does not open a guide", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const stage = page.locator(".disc-stage");
  await stage.evaluate((el) => {
    for (let n = 0; n < 15; n++)
      el.dispatchEvent(
        new WheelEvent("wheel", { deltaY: 3, cancelable: true }),
      );
  });
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
  const hit = page.locator(".disc-hit");
  const box = (await hit.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.locator(".disc-info h2")).toHaveText("RIDDLE JOKER");
  await expect(stage).toBeVisible();
  await page.getByLabel("搜索游戏").fill("不存在的作品");
  await expect(
    page.getByRole("heading", { name: "这里还没有记录" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看全部游戏" }).click();
  await expect(page.locator(".disc-info h2")).toBeVisible();
});

test("opening animation replays after reload and can be skipped", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "跳过动画" }).click();
  await expect(page.getByLabel("开场动画")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("开场动画")).toBeVisible();
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 4000 });
  await page.getByRole("button", { name: "下一部作品" }).click();
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
