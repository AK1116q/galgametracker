import { test, expect } from "@playwright/test";

test("WA2 starts with prerequisites, reveals one choice, restores and undoes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "故事，慢慢读。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "选择路线", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "开始这条路线" }),
  ).toBeDisabled();
  await page.getByLabel("我了解版本说明，会对照游戏画面核对").check();
  await page.getByLabel("我已完成：序章 IC 已完成").check();
  await page.getByRole("button", { name: "开始这条路线" }).click();
  await expect(page.getByText("与她相处的感受", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("联系她的方式", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "我已遇到当前选择" }).click();
  await page.getByRole("radio").filter({ hasText: "相处时感到舒适" }).click();
  await page.getByRole("button", { name: "确认，我选了这一项" }).click();
  await expect(page.getByText("12月2日", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "继续导航", exact: true }).click();
  await expect(page.getByText("12月2日", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "撤销上一步", exact: true }).click();
  await expect(page.getByText("12月1日", { exact: true })).toBeVisible();
  await expect(
    page.getByText("雪菜 Closing Chapter END", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("wrong choice pauses instead of inventing a route", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "选择路线", exact: true }).click();
  await page.getByLabel("我了解版本说明，会对照游戏画面核对").check();
  await page.getByLabel("我已完成：序章 IC 已完成").check();
  await page.getByRole("button", { name: "开始这条路线" }).click();
  await page.getByRole("button", { name: "我已遇到当前选择" }).click();
  await page.getByRole("radio").filter({ hasText: "不擅长应付她" }).click();
  await page.getByRole("button", { name: "确认，我选了这一项" }).click();
  await expect(
    page.getByRole("heading", { name: "先把书签留在这里。" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "我已在游戏中通关" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "我已在游戏回档，撤销这次选择" })
    .click();
  await expect(page.getByText("12月1日", { exact: true })).toBeVisible();
});

test("editor creates a private route, completes it, and exports a backup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "录入攻略", exact: true }).click();
  await page.getByLabel("版本 / 汉化补丁").fill("测试版");
  await page.getByLabel("目标路线", { exact: true }).fill("本机检查路线");
  await page.getByLabel("结局记录名称").fill("测试结局");
  await page.getByLabel("攻略来源", { exact: true }).fill("本人测试笔记");
  await page.getByLabel("使用依据").fill("仅为自动化测试的虚构内容");
  await page.getByLabel("时间 / 章节").fill("第一天");
  await page.getByLabel("当前提示", { exact: true }).fill("去哪里");
  await page.getByLabel("选择 1 选项 1", { exact: true }).fill("去图书馆");
  await page.getByLabel("选择 1 选项 2", { exact: true }).fill("先回家");
  await page.getByRole("button", { name: "保存为私人攻略" }).click();
  await page.getByLabel("我的游戏版本").selectOption({ label: "测试版 · v1" });
  await page.getByLabel("我了解版本说明，会对照游戏画面核对").check();
  await page.getByRole("button", { name: "开始这条路线" }).click();
  await page.getByRole("button", { name: "我已遇到当前选择" }).click();
  await page.getByRole("radio").filter({ hasText: "去图书馆" }).click();
  await page.getByRole("button", { name: "确认，我选了这一项" }).click();
  await expect(
    page.getByRole("heading", { name: "剩下的时间，交给故事。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "我已在游戏中通关" }).click();
  await expect(
    page.getByRole("heading", { name: "这一程，好好收下。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "返回路线选择" }).click();
  const menu = page.getByRole("button", { name: "打开导航" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "数据与设置", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出全部记录" }).click();
  expect((await download).suggestedFilename()).toContain("路线手记");
});

test("malformed import reports an error and retains data", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("导入数据文件")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":999}'),
    });
  await expect(page.getByRole("status")).toContainText("无法导入");
  await expect(
    page.getByRole("heading", { name: "故事，慢慢读。" }),
  ).toBeVisible();
});
