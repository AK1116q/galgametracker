import { test, expect } from "@playwright/test";
test("guest favorites and browsing history persist without registration", async ({ page }) => {
  await openTarget(page);
  await page.getByRole('button', { name: '收藏攻略', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '已收藏 · 点击取消' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '游玩记录', exact: true }).click();
  await expect(page.locator('.saved-section').first().getByRole('button')).toContainText('冬马和纱');
  await expect(page.locator('.saved-section').nth(1).getByRole('button').last()).toContainText('冬马和纱');
  await page.getByRole('button', { name: '清空浏览记录' }).click();
  await expect(page.getByText('暂未浏览攻略。')).toBeVisible();
  await expect(page.locator('.saved-section').first().getByRole('button')).toHaveCount(1);
});
async function openTarget(
  page,
  chapter = "Coda · 最终章",
  target = "冬马和纱 · True Ending",
) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "选择作品：白色相簿2", exact: true })
    .click();
  await page.getByRole("button", { name: chapter }).click();
  await page.getByRole("button", { name: target }).click();
}
test("chapter selection opens a complete target tree without creating progress", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "游戏攻略", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("攻略工作台", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "录入攻略" })).toHaveCount(0);
  await page
    .getByRole("button", { name: "选择作品：白色相簿2", exact: true })
    .click();
  await page.getByRole("button", { name: "IC · 序章" }).click();
  await expect(
    page.getByRole("heading", { name: "IC 没有选项" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "CC · 终章" }).click();
  await expect(
    page.getByRole("button", { name: "冬马和纱 · True Ending" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Coda · 最终章" }).click();
  await page.getByRole("button", { name: "冬马和纱 · True Ending" }).click();
  await expect(page.locator(".tree-step")).toHaveCount(14);
  await expect(page.locator(".target-option").first()).toContainText(
    "第 2 项：交往已有两年",
  );
  await expect(page.locator(".tree-ending")).toContainText(
    "冬马和纱 True Ending",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("galgametracker.web.v1") || '{"sessions":[]}',
        ).sessions,
    ),
  ).toEqual([]);
  await page.getByLabel("显示其他选项").uncheck();
  await expect(page.locator(".other-option")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("optional tracking restores old CC progress and undoes actual choices", async ({
  page,
}) => {
  await openTarget(page, "CC · 终章", "小木曾雪菜 · CC");
  await page.getByLabel("我已完成：序章 IC 已完成").check();
  await page.getByRole("button", { name: "开始记录进度" }).click();
  await page.getByRole("button", { name: "我在游戏中选了第 2 项" }).click();
  await expect(page.locator(".tree-step.current")).toContainText("12月2日");
  await page.reload();
  await expect(page.locator(".tree-step.current")).toContainText("12月2日");
  await page.getByRole("button", { name: "撤销上一步", exact: true }).click();
  await expect(page.locator(".tree-step.current")).toContainText("12月1日");
  await page.getByRole("button", { name: "我在游戏中选了第 1 项" }).click();
  await expect(
    page.getByText("实际选择已偏离本攻略路径", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "我已在游戏中通关" }),
  ).toHaveCount(0);
});
test("Kazusa target can be tracked through all fourteen choices and exported", async ({
  page,
}) => {
  await openTarget(page);
  await page.getByLabel("我已完成：CC 雪菜结局").check();
  await page.getByRole("button", { name: "开始记录进度" }).click();
  for (let i = 0; i < 14; i++)
    await page.locator(".tree-step.current .target-option button").click();
  await page.getByRole("button", { name: "我已在游戏中通关" }).click();
  await expect(page.locator(".tracking-bar")).toContainText("已通关");
  const menu = page.getByRole("button", { name: "打开导航" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "数据与设置", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出全部记录" }).click();
  expect((await pending).suggestedFilename()).toContain("偷吃猫娘达咩哟");
});
test("malformed import retains current data", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("导入数据文件").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.getByRole("status")).toContainText("无法导入");
  await expect(
    page.getByRole("heading", { name: "游戏攻略", exact: true }),
  ).toBeVisible();
});

test("all target entries open, and optional-step text has its own space", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "选择作品：白色相簿2", exact: true })
    .click();
  for (const [chapter, count] of [
    ["CC · 终章", 6],
    ["Coda · 最终章", 4],
  ]) {
    await page.getByRole("button", { name: chapter }).click();
    const cards = page.locator(".target-picker .chapter-button");
    await expect(cards).toHaveCount(count);
    for (let i = 0; i < count; i++) {
      await cards.nth(i).click();
      await expect(page.locator(".tree-ending")).toContainText("目标结局：");
      expect(await page.locator(".tree-step").count()).toBeGreaterThan(0);
    }
  }
  await page.getByRole("button", { name: "CC · 终章" }).click();
  await page.getByRole("button", { name: "小木曾雪菜 · CC" }).click();
  const last = page.locator(".tree-step").last();
  await last.scrollIntoViewIfNeeded();
  const geometry = await last.evaluate((el) => ({
    options: el.querySelector(".tree-branches").getBoundingClientRect().bottom,
    note: el.querySelector(".small-note").getBoundingClientRect().top,
    after: getComputedStyle(el.querySelector(".target-option"), "::after")
      .content,
  }));
  expect(geometry.note - geometry.options).toBeGreaterThanOrEqual(16);
  expect(["none", "normal", '""']).toContain(geometry.after);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("page return buttons keep recorded progress and allow reopening the route", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openTarget(page);
  await page.getByLabel("我已完成：CC 雪菜结局").check();
  await page.getByRole("button", { name: "开始记录进度" }).click();
  await page.locator(".tree-step.current .target-option button").click();
  await page.getByRole("button", { name: "返回篇章与结局选择" }).click();
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "游戏攻略", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续导航", exact: true }).click();
  await expect(page.locator(".tracking-bar")).toContainText("已记录 1 次选择");
  expect(errors).toEqual([]);
});

test("browser back and forward restore chapter, ending, and tracking without leaving the site", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openTarget(page);
  const targetUrl = page.url();
  await page.reload();
  await expect(page.locator(".tree-step")).toHaveCount(14);
  await page.goBack();
  await expect(
    page.locator(".chapter-picker button[aria-pressed=true]"),
  ).toContainText("Coda");
  await expect(page.locator(".guide")).toHaveCount(0);
  await page.goBack();
  await expect(page.locator(".chapter-picker")).toBeVisible();
  await expect(page.locator(".target-picker")).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "游戏攻略", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await page.goForward();
  await page.goForward();
  expect(page.url()).toBe(targetUrl);
  await expect(page.locator(".tree-step")).toHaveCount(14);
  await page.getByLabel("我已完成：CC 雪菜结局").check();
  await page.getByRole("button", { name: "开始记录进度" }).click();
  await page.locator(".tree-step.current .target-option button").click();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "继续已有记录" }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.locator(".tracking-bar")).toContainText("已记录 1 次选择");
  await page.reload();
  await expect(page.locator(".tracking-bar")).toContainText("已记录 1 次选择");
  expect(errors).toEqual([]);
});
test("unavailable shared game or session link fails gracefully", async ({
  page,
}) => {
  await page.goto("/?view=game&game=not-installed");
  await expect(
    page.getByRole("heading", { name: "找不到这部作品" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "游戏攻略", exact: true }),
  ).toBeVisible();
  await page.goto("/?view=play&session=not-on-this-device");
  await expect(
    page.getByRole("heading", { name: "还没有正在导航的路线" }),
  ).toBeVisible();
});
