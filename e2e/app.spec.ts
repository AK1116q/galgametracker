import { test, expect } from "@playwright/test";
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
  await page.getByRole("button", { name: "继续导航", exact: true }).click();
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
  expect((await pending).suggestedFilename()).toContain("路线手记");
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
