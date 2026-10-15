import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { emptyLibrary, packKey } from "../core/backup.mjs";
import { createSession } from "../core/engine.mjs";

const key = "galgametracker.web.v1";
const path = "/guides/white-album-2/wa2-pc-coda-kazusa/1/kazusa-true/";
const pack = JSON.parse(
  readFileSync("data/wa2/kazusa-coda.route.json", "utf8"),
);
const favorite = {
  packKey: packKey(pack),
  routeId: "kazusa-true",
  at: "2026-10-14T00:00:00.000Z",
};
const seeded = () => ({ ...emptyLibrary(), favorites: [favorite] });

async function seed(page: Page, raw: string) {
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key,
    raw,
  });
}
async function stored(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), key);
}
async function rawDownload(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载原始数据", exact: true }).click();
  const downloaded = await pending;
  return JSON.parse(await readFile((await downloaded.path())!, "utf8"));
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("blocked browser storage keeps guides usable and raw export reports failure without an uncaught error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage access blocked", "SecurityError");
    };
  });
  await page.goto(path);
  await expect(page.locator(".tree-step")).toHaveCount(14);
  await expect(page.locator(".notice").first()).toContainText(
    "本地记录暂时无法读取",
  );
  await page.getByRole("button", { name: "下载原始数据", exact: true }).click();
  await expect(page.locator(".toast[role=status]")).toContainText(
    /无法|失败|不可用/,
  );
  expect(errors).toEqual([]);
});

test("quota failure preserves saved favorites and does not announce a successful change", async ({
  page,
}) => {
  const raw = JSON.stringify(seeded());
  await seed(page, raw);
  await page.goto(path);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "已收藏 · 点击取消" }).click();
  await expect(page.locator(".toast[role=status]")).toContainText("保存失败");
  await expect(
    page.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await stored(page)).toBe(raw);
});

for (const [label, raw] of [
  ["empty corrupted record", ""],
  ["corrupted JSON", '{"format":"galgametracker-backup","sessions":['],
  ["unsupported future version", JSON.stringify({ ...seeded(), version: 999 })],
]) {
  test(`${label} remains recoverable as an exact raw backup and cannot be overwritten by browsing`, async ({
    page,
  }) => {
    await seed(page, raw);
    await page.goto(path);
    await expect(page.locator(".notice").first()).toContainText("原数据已保留");
    await page.getByRole("button", { name: "收藏攻略", exact: true }).click();
    await expect(page.locator(".toast[role=status]")).toContainText("读取问题");
    expect(await stored(page)).toBe(raw);
    expect((await rawDownload(page)).raw).toBe(raw);
    await expect(page.locator(".tree-step")).toHaveCount(14);
  });
}

test("invalid imports preserve real existing records byte for byte", async ({
  page,
}) => {
  const raw = JSON.stringify(seeded());
  await seed(page, raw);
  await page.goto(path);
  for (const [name, content] of [
    ["broken.json", "{bad json"],
    ["future.json", JSON.stringify({ ...emptyLibrary(), version: 999 })],
    [
      "invalid-route.json",
      JSON.stringify({
        ...emptyLibrary(),
        favorites: [{ ...favorite, routeId: "missing" }],
      }),
    ],
  ]) {
    await page.getByLabel("导入数据文件").setInputFiles({
      name,
      mimeType: "application/json",
      buffer: Buffer.from(content),
    });
    await expect(page.locator(".toast[role=status]")).toContainText("无法导入");
    expect(await stored(page)).toBe(raw);
    await expect(
      page.getByRole("button", { name: "已收藏 · 点击取消" }),
    ).toHaveAttribute("aria-pressed", "true");
  }
});

test("oversized imports are rejected without replacing existing records", async ({
  page,
}) => {
  const raw = JSON.stringify(seeded());
  await seed(page, raw);
  await page.goto(path);
  await page.getByLabel("导入数据文件").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, " "),
  });
  await expect(page.locator(".toast[role=status]")).toContainText("5 MB");
  expect(await stored(page)).toBe(raw);
});

test("conflicting imported sessions do not partially add incoming favorites", async ({
  page,
}) => {
  const session = createSession(pack, "kazusa-true", ["setsuna-cc-completed"]);
  const raw = JSON.stringify({ ...emptyLibrary(), sessions: [session] });
  await seed(page, raw);
  await page.goto(path);
  const incoming = {
    ...seeded(),
    sessions: [{ ...session, updatedAt: "2027-01-01T00:00:00.000Z" }],
  };
  await page.getByLabel("导入数据文件").setInputFiles({
    name: "conflict.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(incoming)),
  });
  await expect(page.locator(".toast[role=status]")).toContainText(
    "同名游玩记录",
  );
  expect(await stored(page)).toBe(raw);
  await expect(
    page.getByRole("button", { name: "收藏攻略", exact: true }),
  ).toBeVisible();
});

test("other tabs update favorites and clearing storage cannot resurrect old data", async ({
  page,
  context,
}) => {
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "收藏攻略", exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: "reduce" });
  await other.goto(path);
  await other.getByRole("button", { name: "收藏攻略", exact: true }).click();
  await expect(
    other.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.bringToFront();
  await expect(
    page.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toHaveAttribute("aria-pressed", "true");
  await other.bringToFront();
  await other.evaluate(() => localStorage.clear());
  await page.bringToFront();
  await expect(
    page.getByRole("button", { name: "收藏攻略", exact: true }),
  ).toBeVisible();
  expect(await stored(page)).toBeNull();
  await other.close();
});

test("a delayed import merges with changes saved while the file is being read", async ({
  page,
}) => {
  await page.goto(path);
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      const value = await original.call(this);
      if (this.name === "delayed.json")
        await new Promise<void>((resolve) => {
          (window as unknown as { releaseImport: () => void }).releaseImport =
            resolve;
        });
      return value;
    };
  });
  await page.getByLabel("导入数据文件").setInputFiles({
    name: "delayed.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(emptyLibrary())),
  });
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { releaseImport?: () => void })
        .releaseImport === "function",
  );
  await page.getByRole("button", { name: "收藏攻略", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() =>
    (window as unknown as { releaseImport: () => void }).releaseImport(),
  );
  await expect(page.locator(".toast[role=status]")).toContainText("导入完成");
  await expect(
    page.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse((await stored(page))!).favorites).toHaveLength(1);
});

test("a corrupt update from another tab retains the last readable records for emergency export", async ({
  page,
  context,
}) => {
  await seed(page, JSON.stringify(seeded()));
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toHaveAttribute("aria-pressed", "true");
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: "reduce" });
  await other.goto(path);
  const corrupt = '{"format":"galgametracker-backup","sessions":';
  await other.evaluate(
    ({ key, corrupt }) => localStorage.setItem(key, corrupt),
    { key, corrupt },
  );
  await page.bringToFront();
  await expect(page.locator(".notice").first()).toContainText(
    "本地记录暂时无法读取",
  );
  await expect(
    page.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await stored(page)).toBe(corrupt);
  await page.getByRole("button", { name: "数据与设置", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出全部记录", exact: true }).click();
  const exported = await pending;
  const data = JSON.parse(await readFile((await exported.path())!, "utf8"));
  expect(data.favorites).toEqual([favorite]);
  await other.close();
});

test("writes detect an external update even before its storage notification arrives", async ({
  page,
  context,
}) => {
  await seed(page, JSON.stringify(seeded()));
  await page.addInitScript(() => {
    // Simulate a suspended tab whose cross-tab notification has not been delivered yet.
    // Register before React so no application listener can observe this update first.
    const state = window as unknown as { blockedStorageEvents: number };
    state.blockedStorageEvents = 0;
    window.addEventListener(
      "storage",
      (event) => {
        state.blockedStorageEvents += 1;
        event.stopImmediatePropagation();
      },
      true,
    );
  });
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toHaveAttribute("aria-pressed", "true");
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: "reduce" });
  await other.goto(path);
  const newer = JSON.stringify({
    ...seeded(),
    favorites: [
      favorite,
      { ...favorite, packKey: "wa2-pc-cc-setsuna@1", routeId: "setsuna-cc" },
    ],
  });
  await other.evaluate(({ key, newer }) => localStorage.setItem(key, newer), {
    key,
    newer,
  });
  await page.bringToFront();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { blockedStorageEvents: number })
            .blockedStorageEvents,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "已收藏 · 点击取消" }).click();
  await expect(page.locator(".toast[role=status]")).toContainText(
    /另|变化|更新|重试/,
  );
  expect(await stored(page)).toBe(newer);
  await expect(
    page.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toHaveAttribute("aria-pressed", "true");
  await other.close();
});

test("a storage notification cannot let an old-render action erase another tab's new favorite", async ({
  page,
  context,
}) => {
  await seed(page, JSON.stringify(seeded()));
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "已收藏 · 点击取消" }),
  ).toBeVisible();
  await page.evaluate(() => {
    // Exercise the interval after storage refs update but before React renders.
    window.addEventListener(
      "storage",
      () => {
        document.querySelector<HTMLButtonElement>(".favorite-toggle")!.click();
        (
          window as unknown as { clickedDuringStorage: boolean }
        ).clickedDuringStorage = true;
      },
      { once: true },
    );
  });
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: "reduce" });
  await other.goto(path);
  const added = {
    ...favorite,
    packKey: "wa2-pc-cc-setsuna@1",
    routeId: "setsuna-cc",
  };
  const newer = JSON.stringify({
    ...seeded(),
    favorites: [favorite, added],
  });
  await other.evaluate(({ key, newer }) => localStorage.setItem(key, newer), {
    key,
    newer,
  });
  await page.bringToFront();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { clickedDuringStorage: boolean })
            .clickedDuringStorage,
      ),
    )
    .toBe(true);
  await expect(page.locator(".toast[role=status]")).toContainText(/更新|重试/);
  expect(JSON.parse((await stored(page))!).favorites).toEqual([
    favorite,
    added,
  ]);
  await page.getByRole("button", { name: "已收藏 · 点击取消" }).click();
  await expect(page.locator(".toast[role=status]")).toContainText("已取消收藏");
  expect(JSON.parse((await stored(page))!).favorites).toEqual([added]);
  await other.close();
});
