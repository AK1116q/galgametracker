import GuideFeedback from "./GuideFeedback";
import RouteBrief from "./RouteBrief";
import { reviewInfo, findGuideNodes } from "../core/guide-info.mjs";
import GameCover, { CoverSources } from "./GameCover";
import CinematicChrome from "./CinematicChrome";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  BookOpen,
  BookmarkSimple,
  Compass,
  Notebook,
  GearSix,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  MagnifyingGlass,
  ShieldCheck,
  Check,
  CheckCircle,
  CaretRight,
  DownloadSimple,
  UploadSimple,
  Clock,
  WarningCircle,
  X,
  FileText,
  FolderOpen,
  List,
  MusicNotes,
} from "@phosphor-icons/react";
import {
  createSession,
  replay,
  recordChoice,
  undo,
  confirmEnding,
  skipChoice,
} from "../core/engine.mjs";
import {
  emptyLibrary,
  STORAGE_KEY,
  MAX_IMPORT_BYTES,
  packKey,
  sessionPackKey,
  validateBackup,
  mergeBackup,
} from "../core/backup.mjs";
import { guidePath } from "../core/guide.mjs";
import kazusaData from "../data/wa2/kazusa-coda.route.json";
import demoData from "../data/examples/demo.route.json";
import wa2Data from "../data/wa2/setsuna-cc.route.json";
import type { Pack, Session, Library, SavedRoute } from "./types";
const MusicDock = lazy(() => import("./MusicDock"));

const extraPacks = Object.values(
  import.meta.glob<Pack>("../data/**/*.route.json", {
    eager: true,
    import: "default",
  }),
).filter(
  (p) => p.id !== wa2Data.id && p.id !== kazusaData.id && p.id !== demoData.id,
);
const BUILTINS = [wa2Data, kazusaData, ...extraPacks, demoData] as Pack[];
type View = "library" | "game" | "play" | "records" | "settings";
type Navigation = {
  view: View;
  gameId: string;
  activeId: string;
  chapter: string;
  target: string;
};
function readNavigation(): Navigation {
  const params = new URLSearchParams(location.search);
  const requested = params.get("view") as View;
  return {
    view: ["library", "game", "play", "records", "settings"].includes(requested)
      ? requested
      : "library",
    gameId: params.get("game") || "white-album-2",
    activeId: params.get("session") || "",
    chapter: params.get("chapter") || "",
    target: params.get("target") || "",
  };
}
function navigationUrl(next: Navigation) {
  const url = new URL(location.href);
  for (const key of ["view", "game", "session", "chapter", "target"])
    url.searchParams.delete(key);
  if (next.view !== "library") url.searchParams.set("view", next.view);
  if (next.view === "game") {
    url.searchParams.set("game", next.gameId);
    if (next.chapter) url.searchParams.set("chapter", next.chapter);
    if (next.target) url.searchParams.set("target", next.target);
  }
  if (next.view === "play" && next.activeId)
    url.searchParams.set("session", next.activeId);
  url.hash = "";
  return url.pathname + url.search;
}
const statusText = (p: Pack) => reviewInfo(p).label;
const dateText = (date: string) =>
  new Date(date).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function readInitial(): { library: Library; problem: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      library: raw ? validateBackup(JSON.parse(raw), BUILTINS) : emptyLibrary(),
      problem: "",
    };
  } catch {
    return {
      library: emptyLibrary(),
      problem:
        "本地记录暂时无法读取。原数据已保留，请先下载原始备份，避免覆盖。",
    };
  }
}
function Notice({
  children,
  kind = "",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return (
    <div className={`notice ${kind}`}>
      <WarningCircle size={20} />
      <div>{children}</div>
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <BookmarkSimple size={34} weight="duotone" />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function SourceDetails({ pack }: { pack: Pack }) {
  return (
    <details className="source-details">
      <summary>
        <FileText size={17} />
        来源与核对说明<span>阅读前请留意剧透</span>
      </summary>
      <div className="source-body">
        <p>{statusText(pack)}。资料核对不等于实机通关。</p>
        {pack.notes?.map((n) => (
          <p key={n}>{n}</p>
        ))}
        {pack.sources.map((s, i) => (
          <p key={s.id}>
            {/^https:\/\//.test(s.reference) ? (
              <a href={s.reference} target="_blank" rel="noreferrer">
                来源 {i + 1}：{new URL(s.reference).hostname}
                <ArrowUpRight size={14} />
              </a>
            ) : (
              s.reference
            )}
            <small>{s.permission}</small>
          </p>
        ))}
        {pack.reviews.map((r, i) => (
          <p key={i}>
            <strong>
              {r.date} · {r.reviewer}
            </strong>
            <small>{r.evidence}</small>
          </p>
        ))}
      </div>
    </details>
  );
}

export default function App() {
  const [initial] = useState(readInitial);
  const [library, setLibrary] = useState<Library>(initial.library);
  const [problem, setProblem] = useState(initial.problem);
  const [navigation, setNavigation] = useState<Navigation>(readNavigation);
  const { view, gameId, activeId } = navigation;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [music, setMusic] = useState(false);
  const musicButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const packs = useMemo(
    () => [
      ...BUILTINS,
      ...library.packs.filter(
        (p) => !BUILTINS.some((b) => packKey(b) === packKey(p)),
      ),
    ],
    [library.packs],
  );
  const allGames = [...new Map(packs.map((p) => [p.game.id, p.game])).values()];
  const selectedPacks = useMemo(
    () => packs.filter((p) => p.game.id === gameId),
    [packs, gameId],
  );
  const active = library.sessions.find((s) => s.id === activeId);
  const activePack =
    active && packs.find((p) => packKey(p) === sessionPackKey(active));
  const ongoing = [...library.sessions]
    .filter((s) => !s.completed)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recent = ongoing[0];
  const recentPack =
    recent && packs.find((p) => packKey(p) === sessionPackKey(recent));

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        const result = readInitial();
        setLibrary(result.library);
        setProblem(result.problem);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    document.title = `${{ library: "游戏库", game: "路线选择", play: "路线导航", records: "游玩记录", settings: "数据与设置" }[view]} · 偷吃猫娘达咩哟的galgame攻略收集站`;
  }, [view]);

  useEffect(() => {
    const restore = () => {
      setNavigation(readNavigation());
      setMenu(false);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Do not promote a several-thousand-pixel route tree to one animated layer.
    const elements = [
      ...(mainRef.current?.querySelectorAll<HTMLElement>(
        ".page-heading, .chapter-picker, .target-picker, .guide-title",
      ) ?? []),
    ];
    const animations = elements.slice(0, 3).map((el) =>
      el.animate(
        [
          { opacity: 0, transform: "translate3d(0,8px,0)" },
          { opacity: 1, transform: "translate3d(0,0,0)" },
        ],
        { duration: 220, easing: "cubic-bezier(.16,1,.3,1)" },
      ),
    );
    return () => animations.forEach((animation) => animation.cancel());
  }, [navigation]);

  function navigate(next: View, selection: Partial<Navigation> = {}) {
    const destination = {
      view: next,
      gameId,
      activeId,
      chapter: "",
      target: "",
      ...selection,
    };
    const url = navigationUrl(destination);
    if (url !== location.pathname + location.search)
      history.pushState(null, "", url);
    setNavigation(destination);
    setMenu(false);
    window.scrollTo(0, 0);
  }
  function commit(next: Library) {
    if (problem) {
      setToast("请先处理本地数据读取问题。");
      return false;
    }
    try {
      validateBackup(next, BUILTINS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setLibrary(next);
      return true;
    } catch (error) {
      setToast(`保存失败：${(error as Error).message}。原记录未改变。`);
      return false;
    }
  }
  function bookmarkRoute(pack: Pack, routeId: string, choiceId: string) {
    return commit({
      ...library,
      bookmarks: [
        {
          packKey: packKey(pack),
          routeId,
          choiceId,
          at: new Date().toISOString(),
        },
        ...(library.bookmarks ?? []).filter(
          (b) => b.packKey !== packKey(pack) || b.routeId !== routeId,
        ),
      ].slice(0, 1000),
    });
  }
  function saveSession(session: Session) {
    const next = {
      ...library,
      sessions: library.sessions.map((s) =>
        s.id === session.id ? session : s,
      ),
    };
    return commit(next);
  }
  function resume(session: Session) {
    navigate("play", { activeId: session.id });
  }
  function openGame(id: string) {
    navigate("game", { gameId: id });
  }
  function rememberRoute(chapter: string, target: string) {
    const pack = packs.find((p) =>
      p.routes.some((r) => `${packKey(p)}/${r.id}` === target),
    );
    const route = pack?.routes.find(
      (r) => `${packKey(pack)}/${r.id}` === target,
    );
    if (pack && route) {
      const item = {
        packKey: packKey(pack),
        routeId: route.id,
        at: new Date().toISOString(),
      };
      commit({
        ...library,
        visits: [
          item,
          ...(library.visits ?? []).filter(
            (v) => v.packKey !== item.packKey || v.routeId !== item.routeId,
          ),
        ].slice(0, 100),
      });
    }
    navigate("game", { chapter, target });
  }
  function toggleFavorite(pack: Pack, routeId: string) {
    const favorites = library.favorites ?? [];
    const exists = favorites.some(
      (f) => f.packKey === packKey(pack) && f.routeId === routeId,
    );
    const next = exists
      ? favorites.filter(
          (f) => f.packKey !== packKey(pack) || f.routeId !== routeId,
        )
      : [
          { packKey: packKey(pack), routeId, at: new Date().toISOString() },
          ...favorites,
        ];
    if (commit({ ...library, favorites: next }))
      setToast(exists ? "已取消收藏。" : "已收藏到当前浏览器。");
  }
  function savedRoutes(items: SavedRoute[]) {
    return items.map((item) => {
      const pack = packs.find((p) => packKey(p) === item.packKey);
      const route = pack?.routes.find((r) => r.id === item.routeId);
      if (!pack || !route) return null;
      return (
        <button
          className="saved-route"
          key={`${item.packKey}/${item.routeId}`}
          onClick={() =>
            navigate("game", {
              gameId: pack.game.id,
              chapter: chapterOf(pack),
              target: `${item.packKey}/${item.routeId}`,
            })
          }
        >
          <span>
            <strong>{pack.game.title}</strong>
            <small>{route.safeLabel}</small>
          </span>
          <CaretRight size={18} />
        </button>
      );
    });
  }
  function start(pack: Pack, routeId: string, initialEndingIds: string[]) {
    try {
      const session = createSession(pack, routeId, initialEndingIds) as Session;
      if (commit({ ...library, sessions: [...library.sessions, session] }))
        resume(session);
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  function completedSession(pack: Pack, session: Session) {
    try {
      const updated = confirmEnding(pack, session) as Session;
      const endingId = replay(pack, updated).position.id;
      const completed = library.completed.some(
        (e) => e.packKey === packKey(pack) && e.endingId === endingId,
      )
        ? library.completed
        : [
            ...library.completed,
            { packKey: packKey(pack), endingId, at: new Date().toISOString() },
          ];
      if (
        commit({
          ...library,
          completed,
          sessions: library.sessions.map((s) =>
            s.id === session.id ? updated : s,
          ),
        })
      )
        setToast("通关已记录。");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error("单个文件请控制在 5 MB 以内。");
      const data = JSON.parse(await file.text());
      const incoming =
        data.format === "galgametracker-backup"
          ? data
          : { ...emptyLibrary(), packs: [data] };
      const next = mergeBackup(library, incoming, BUILTINS);
      if (commit(next)) setToast("导入完成，已有记录已保留。");
    } catch (e) {
      setToast(`无法导入：${(e as Error).message}`);
    }
  }
  function backup() {
    download(
      `偷吃猫娘达咩哟的galgame攻略收集站-${new Date().toISOString().slice(0, 10)}.json`,
      {
        ...library,
        packs,
      },
    );
  }

  const nav = [
    { id: "library" as View, label: "我的游戏库", Icon: BookOpen },
    { id: "play" as View, label: "路线导航", Icon: Compass },
    { id: "records" as View, label: "游玩记录", Icon: Notebook },
  ];
  return (
    <div
      className={`app-shell ${(view === "game" && navigation.target) || (view === "play" && activePack) ? "reading-mode" : ""}`}
    >
      <CinematicChrome />
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button className="brand" onClick={() => navigate("library")}>
          <span className="brand-mark">
            <BookmarkSimple size={23} weight="fill" />
          </span>
          <span>
            偷吃猫娘达咩哟的galgame攻略收集站<small>GALGAME ARCHIVE</small>
          </span>
        </button>
        <div className="sidebar-label">我的空间</div>
        <nav aria-label="主导航">
          {nav.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id || (id === "library" && view === "game") ? "active" : ""}`}
              onClick={() => {
                if (id === "play" && !active && recent) resume(recent);
                else navigate(id);
              }}
            >
              <Icon size={20} weight={view === id ? "fill" : "regular"} />
              {label}
              {id === "library" && (
                <span className="nav-count">
                  {allGames.filter((g) => g.id !== "demo-game").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-label second-label">整理与维护</div>
        <button
          className={`nav-item ${view === "settings" ? "active" : ""}`}
          onClick={() => navigate("settings")}
        >
          <GearSix size={20} />
          数据与设置
        </button>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="tiny-icon">
              <ShieldCheck size={21} />
            </span>
            <strong>本地记录</strong>
            <p>
              记录保存在当前浏览器。
              <br />
              支持导出备份。
            </p>
            <button className="text-button" onClick={backup}>
              备份我的记录
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="sidebar-version">
            <span></span>
            <span>v0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="打开导航"
              onClick={() => setMenu(!menu)}
            >
              <List size={23} />
            </button>
            <span>攻略站</span>
            <CaretRight size={12} />
            <strong>
              {
                {
                  library: "游戏库",
                  game: "游戏详情",
                  play: "路线导航",
                  records: "游玩记录",

                  settings: "数据与设置",
                }[view]
              }
            </strong>
          </div>
          <span className="topbar-right">
            <ShieldCheck size={16} />
            游客使用
          </span>
        </header>
        <main
          ref={mainRef}
          id="main"
          className={`main-content ${view === "play" ? "play-content" : ""}`}
        >
          {problem && (
            <Notice kind="error">
              {problem}
              <button
                className="text-button"
                onClick={() => {
                  const raw = localStorage.getItem(STORAGE_KEY);
                  download("偷吃猫娘达咩哟的galgame攻略收集站-原始数据.json", {
                    raw,
                  });
                }}
              >
                下载原始数据
              </button>
            </Notice>
          )}
          {view === "library" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR SMALL COLLECTION</div>
                  <h1>游戏攻略</h1>
                  <p>选择作品、篇章和目标结局，查看各个时间点的选项。</p>
                </div>
              </div>
              {recent && (
                <section className="continue-panel">
                  <div className="continue-icon">
                    <BookmarkSimple size={30} weight="duotone" />
                  </div>
                  <div className="continue-copy">
                    <span className="eyebrow">
                      {recent ? "CONTINUE YOUR STORY" : "START A NEW CHAPTER"}
                    </span>
                    <h2>
                      {recentPack
                        ? `继续《${recentPack.game.title}》`
                        : "从你的第一条路线开始"}
                    </h2>
                    <p>
                      {recentPack && recent
                        ? `${recentPack.routes.find((r) => r.id === recent.routeId)?.safeLabel} · 已记录 ${recent.events.length} 次选择`
                        : "《白色相簿2》雪菜 CC 路线已整理，等你一边游玩，一边核对。"}
                    </p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() =>
                      recent ? resume(recent) : openGame("white-album-2")
                    }
                  >
                    {recent ? "继续导航" : "选择路线"}
                    <ArrowRight size={17} />
                  </button>
                </section>
              )}
              <div className="section-toolbar">
                <div className="tabs" aria-label="游戏筛选">
                  {[
                    ["all", "全部游戏"],
                    ["playing", "正在游玩"],
                    ["completed", "已通关"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={filter === id ? "selected" : ""}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                      {id === "all" && (
                        <span>
                          {allGames.filter((g) => g.id !== "demo-game").length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <MagnifyingGlass size={18} />
                  <input
                    aria-label="搜索游戏"
                    placeholder="搜索名称、别名…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="game-grid">
                {allGames
                  .filter((g) => g.id !== "demo-game")
                  .filter((g) =>
                    [g.title, ...g.aliases]
                      .join(" ")
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .filter(
                    (g) =>
                      filter === "all" ||
                      library.sessions.some(
                        (s) =>
                          packs.find((p) => packKey(p) === sessionPackKey(s))
                            ?.game.id === g.id &&
                          (filter === "completed" ? s.completed : !s.completed),
                      ),
                  )
                  .map((g, index) => (
                    <button
                      key={g.id}
                      className="game-card"
                      aria-label={`选择作品：${g.title}`}
                      onClick={() => openGame(g.id)}
                    >
                      <GameCover
                        gameId={g.id}
                        title={g.title}
                        priority={index === 0}
                      />
                      <div className="game-card-body">
                        <h3>
                          {g.title}
                          <ArrowUpRight size={18} />
                        </h3>
                        <p>
                          {packs
                            .filter((p) => p.game.id === g.id)
                            .reduce((n, p) => n + p.routes.length, 0)}{" "}
                          条路线 · PC / 中文
                        </p>
                        <div className="card-foot">
                          <span className="badge blue">
                            {BUILTINS.some(
                              (p) =>
                                p.game.id === g.id &&
                                p.status === "source_checked",
                            )
                              ? "资料交叉核对 · 未实机"
                              : "私人攻略"}
                          </span>
                          <span>
                            查看攻略
                            <ArrowRight size={14} />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
              {(query || filter !== "all") &&
                !allGames.some(
                  (g) =>
                    g.id !== "demo-game" &&
                    [g.title, ...g.aliases]
                      .join(" ")
                      .toLowerCase()
                      .includes(query.toLowerCase()) &&
                    (filter === "all" ||
                      library.sessions.some(
                        (s) =>
                          packs.find((p) => packKey(p) === sessionPackKey(s))
                            ?.game.id === g.id &&
                          (filter === "completed" ? s.completed : !s.completed),
                      )),
                ) && (
                  <Empty
                    title="这里还没有记录"
                    text="换个名称搜索，或开始一段新的游玩。"
                    action={
                      <button
                        className="button secondary"
                        onClick={() => {
                          setQuery("");
                          setFilter("all");
                        }}
                      >
                        查看全部游戏
                      </button>
                    }
                  />
                )}
              <CoverSources />
              <div className="library-footer">
                <p>
                  <ShieldCheck size={17} />
                  按篇章与目标结局查询攻略。
                </p>
                <button
                  className="text-button"
                  onClick={() => openGame("demo-game")}
                >
                  先用虚构示例试试
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
          {view === "game" &&
            (selectedPacks.length ? (
              <GameView
                key={gameId}
                packs={selectedPacks}
                chapter={navigation.chapter}
                target={navigation.target}
                select={rememberRoute}
                toggleFavorite={toggleFavorite}
                bookmarkRoute={bookmarkRoute}
                library={library}
                start={start}
                resume={resume}
                back={() => navigate("library")}
              />
            ) : (
              <Empty
                title="找不到这部作品"
                text="该攻略可能尚未导入本机。"
                action={
                  <button
                    className="button secondary"
                    onClick={() => navigate("library")}
                  >
                    返回游戏库
                  </button>
                }
              />
            ))}
          {view === "play" &&
            (active && activePack ? (
              <PlayView
                key={active.id}
                pack={activePack}
                session={active}
                save={saveSession}
                complete={() => completedSession(activePack, active)}
                back={() => openGame(activePack.game.id)}
                notify={setToast}
                library={library}
                bookmarkRoute={bookmarkRoute}
              />
            ) : (
              <Empty
                title="还没有正在导航的路线"
                text="先选作品、篇章和目标结局，即可查看路线树。"
                action={
                  <button
                    className="button primary"
                    onClick={() => navigate("library")}
                  >
                    去游戏库
                    <ArrowRight size={17} />
                  </button>
                }
              />
            ))}
          {view === "records" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR READING JOURNAL</div>
                  <h1>收藏与记录</h1>
                  <p>查看已保存的选择和通关记录。</p>
                </div>
                <button className="button secondary" onClick={backup}>
                  <DownloadSimple size={17} />
                  导出备份
                </button>
              </div>
              <section className="saved-section">
                <h2>收藏的攻略</h2>
                {(library.favorites?.length ?? 0) > 0 ? (
                  savedRoutes(library.favorites!)
                ) : (
                  <p>在目标路线下点击“收藏攻略”。</p>
                )}
              </section>
              <section className="saved-section">
                <div className="section-toolbar">
                  <h2>最近浏览</h2>
                  {!!library.visits?.length && (
                    <button
                      className="text-button"
                      onClick={() => commit({ ...library, visits: [] })}
                    >
                      清空浏览记录
                    </button>
                  )}
                </div>
                {(library.visits?.length ?? 0) > 0 ? (
                  savedRoutes(library.visits!)
                ) : (
                  <p>暂未浏览攻略。</p>
                )}
              </section>
              <h2>游玩进度</h2>
              <div className="record-summary">
                <div>
                  <strong>{library.sessions.length}</strong>
                  <span>段游玩记录</span>
                </div>
                <div>
                  <strong>{ongoing.length}</strong>
                  <span>条记录进行中</span>
                </div>
                <div>
                  <strong>{library.completed.length}</strong>
                  <span>个结局已确认</span>
                </div>
              </div>
              {!library.sessions.length ? (
                <Empty
                  title="暂无游玩进度"
                  text="开始路线导航后，你的游玩记录会保存在这里。"
                />
              ) : (
                <div className="record-list">
                  {[...library.sessions].reverse().map((s) => {
                    const p = packs.find(
                      (p) => packKey(p) === sessionPackKey(s),
                    )!;
                    return (
                      <button
                        className="record-row"
                        key={s.id}
                        onClick={() => resume(s)}
                      >
                        <span className="record-icon">
                          {s.completed ? (
                            <CheckCircle size={25} weight="duotone" />
                          ) : (
                            <BookmarkSimple size={25} weight="duotone" />
                          )}
                        </span>
                        <span className="record-copy">
                          <strong>{p.game.title}</strong>
                          <span>
                            {
                              p.routes.find((r) => r.id === s.routeId)
                                ?.safeLabel
                            }{" "}
                            · {p.release.label}
                          </span>
                        </span>
                        <span className="record-meta">
                          {s.events.length} 次选择
                          <small>{dateText(s.updatedAt)}</small>
                        </span>
                        <span className={`badge ${s.completed ? "green" : ""}`}>
                          {s.completed ? "已通关" : "进行中"}
                        </span>
                        <CaretRight size={17} />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {view === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MAKE YOURSELF AT HOME</div>
                  <h1>数据与设置</h1>
                  <p>备份与恢复本地记录。</p>
                </div>
              </div>
              <section className="settings-section">
                <div className="settings-icon">
                  <FolderOpen size={26} />
                </div>
                <div>
                  <h2>数据存储位置</h2>
                  <p>
                    收藏、浏览记录、游玩进度和导入的攻略仅保存在当前浏览器，不会上传到服务器。换设备、换网址或清除浏览器数据前，请先导出备份。
                  </p>
                  <div className="button-row">
                    <button className="button primary" onClick={backup}>
                      <DownloadSimple size={17} />
                      导出全部记录
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => importRef.current?.click()}
                    >
                      <UploadSimple size={17} />
                      导入备份或攻略
                    </button>
                  </div>
                  <small>
                    导入会保留已有数据。遇到相同版本冲突时，会停止导入。
                  </small>
                </div>
              </section>
              <section className="settings-section">
                <div className="settings-icon">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <h2>攻略显示范围</h2>
                  <p>
                    路线树直接显示目标路径的全部选项，不包含剧情解析。外部来源可能包含剧情内容。
                  </p>
                </div>
              </section>
              <section className="settings-section">
                <div className="settings-icon">
                  <FileText size={26} />
                </div>
                <div>
                  <h2>关于偷吃猫娘达咩哟的galgame攻略收集站</h2>
                  <p>
                    一个面向小规模中文 Galgame 玩家的非官方工具。已收录 6
                    部作品、36
                    条主线／结局路径，资料已核对，仍待实机检查。游戏名称权利属于其权利人。
                  </p>
                  <a
                    className="text-button"
                    href="https://github.com/AK1116q/galgametracker"
                    target="_blank"
                    rel="noreferrer"
                  >
                    项目仓库
                    <ArrowUpRight size={15} />
                  </a>
                </div>
              </section>
            </>
          )}
        </main>
        <footer className="page-footer">
          <span>偷吃猫娘达咩哟的galgame攻略收集站</span>
          <span></span>
          <span>LOCAL FIRST · v0.1</span>
        </footer>
      </div>
      {!music && (
        <button
          ref={musicButtonRef}
          className="music-launch"
          onClick={() => setMusic(true)}
        >
          <MusicNotes size={19} />
          音乐
        </button>
      )}
      {music && (
        <Suspense
          fallback={
            <button className="music-launch" onClick={() => setMusic(false)}>
              正在加载音乐面板 · 取消
            </button>
          }
        >
          <MusicDock
            close={() => {
              setMusic(false);
              requestAnimationFrame(() => musicButtonRef.current?.focus());
            }}
          />
        </Suspense>
      )}
      <input
        ref={importRef}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        aria-label="导入数据文件"
        onChange={importFile}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="关闭提示"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function chapterOf(pack: Pack) {
  if (pack.game.id === "white-album-2" && pack.release.id === "wa2-pc-cc")
    return "cc";
  if (pack.game.id === "white-album-2" && pack.release.id === "wa2-pc-coda")
    return "coda";
  return "other";
}
function GameView({
  packs,
  chapter: selectedChapter,
  toggleFavorite,
  bookmarkRoute,
  target,
  select,
  library,
  start,
  resume,
  back,
}: {
  packs: Pack[];
  chapter: string;
  target: string;
  select: (chapter: string, target: string) => void;
  toggleFavorite: (pack: Pack, routeId: string) => void;
  bookmarkRoute: (pack: Pack, routeId: string, choiceId: string) => boolean;
  library: Library;
  start: (p: Pack, r: string, e: string[]) => void;
  resume: (s: Session) => void;
  back: () => void;
}) {
  const wa2 = packs[0].game.id === "white-album-2";
  const chapter = selectedChapter || (wa2 ? "" : "other");
  const setChapter = (value: string) => select(value, "");
  const setTarget = (value: string) => select(chapter, value);
  const [ready, setReady] = useState(false);
  const stepCounts = useMemo(
    () =>
      new Map(
        packs.flatMap((p) =>
          p.routes.map(
            (r) =>
              [
                `${packKey(p)}/${r.id}`,
                guidePath(p, r.id).nodes.length,
              ] as const,
          ),
        ),
      ),
    [packs],
  );
  useEffect(() => setReady(false), [chapter, target]);
  const chapters = wa2
    ? [
        { id: "ic", label: "IC · 序章", note: "无选项" },
        {
          id: "cc",
          label: "CC · 终章",
          note: "雪菜 · 小春 · 麻理 · 千晶 · 滑雪结局",
        },
        {
          id: "coda",
          label: "Coda · 最终章",
          note: "雪菜 TE · 冬马 TE · 冬马 NE · 通常结局",
        },
        ...(packs.some((p) => chapterOf(p) === "other")
          ? [{ id: "other", label: "其他攻略", note: "导入的版本" }]
          : []),
      ]
    : [{ id: "other", label: "已收录攻略", note: "" }];
  const available = packs.filter((p) => chapterOf(p) === chapter);
  const selected = available
    .flatMap((pack) => pack.routes.map((route) => ({ pack, route })))
    .find(({ pack, route }) => `${packKey(pack)}/${route.id}` === target);
  const previous =
    selected &&
    [...library.sessions]
      .reverse()
      .find(
        (s) =>
          sessionPackKey(s) === packKey(selected.pack) &&
          s.routeId === selected.route.id &&
          !s.completed,
      );
  return (
    <>
      <button className="back-link" onClick={back}>
        <ArrowLeft size={16} />
        返回游戏库
      </button>
      <div className="page-heading">
        <div>
          <h1>{packs[0].game.title}</h1>
          <p>选择篇章，再选择目标结局。</p>
        </div>
      </div>
      <section className="chapter-picker" aria-label="选择篇章">
        <h2>1. 选择篇章</h2>
        <div className="chapter-options">
          {chapters.map((c) => (
            <button
              key={c.id}
              className={`chapter-button ${chapter === c.id ? "selected" : ""}`}
              aria-pressed={chapter === c.id}
              onClick={() => {
                setChapter(c.id);
                setReady(false);
              }}
            >
              <strong>{c.label}</strong>
              <span>{c.note}</span>
            </button>
          ))}
        </div>
      </section>
      {chapter === "ic" && (
        <section className="chapter-info">
          <h2>IC 没有选项</h2>
          <p>按顺序阅读即可。完成 IC 后进入 CC。</p>
          <button className="button secondary" onClick={() => setChapter("cc")}>
            查看 CC 攻略
          </button>
        </section>
      )}
      {chapter && chapter !== "ic" && (
        <section className="target-picker">
          <h2>2. 选择目标结局</h2>
          <div className="chapter-options">
            {available.flatMap((pack) =>
              pack.routes.map((route) => (
                <button
                  key={`${packKey(pack)}/${route.id}`}
                  aria-pressed={target === `${packKey(pack)}/${route.id}`}
                  className={`chapter-button ${target === `${packKey(pack)}/${route.id}` ? "selected" : ""}`}
                  onClick={() => {
                    setTarget(`${packKey(pack)}/${route.id}`);
                    setReady(false);
                  }}
                >
                  <strong>{route.safeLabel}</strong>
                  <span>
                    {stepCounts.get(`${packKey(pack)}/${route.id}`)} 个攻略步骤
                  </span>
                  <small>
                    前置：
                    {route.requiredEndingIds
                      .map(
                        (id) =>
                          pack.endings.find((e) => e.id === id)?.safeLabel ??
                          id,
                      )
                      .join("、") || "无"}
                  </small>
                </button>
              )),
            )}
          </div>
          <p className="small-note">
            {chapter === "cc"
              ? "6 个结局。千晶 True Ending 需要先通关千晶 Normal Ending。"
              : chapter === "coda"
                ? "4 个结局。完成 CC 雪菜结局后进入 Coda。"
                : ""}
          </p>
        </section>
      )}
      {selected && (
        <>
          <button
            className="button secondary favorite-toggle"
            aria-pressed={
              !!library.favorites?.some(
                (f) =>
                  f.packKey === packKey(selected.pack) &&
                  f.routeId === selected.route.id,
              )
            }
            onClick={() => toggleFavorite(selected.pack, selected.route.id)}
          >
            <BookmarkSimple size={18} />
            {library.favorites?.some(
              (f) =>
                f.packKey === packKey(selected.pack) &&
                f.routeId === selected.route.id,
            )
              ? "已收藏 · 点击取消"
              : "收藏攻略"}
          </button>
          <GuideTree
            key={target}
            pack={selected.pack}
            routeId={selected.route.id}
            bookmark={
              library.bookmarks?.find(
                (b) =>
                  b.packKey === packKey(selected.pack) &&
                  b.routeId === selected.route.id,
              )?.choiceId
            }
            onBookmark={(choiceId) =>
              bookmarkRoute(selected.pack, selected.route.id, choiceId)
            }
          />
          <section className="tracking-tools">
            <h2>记录进度（可选）</h2>
            <p>查看攻略无需记录。开启后，可以逐次保存你在游戏中的实际选择。</p>
            {previous ? (
              <button
                className="button secondary"
                onClick={() => resume(previous)}
              >
                继续已有记录
              </button>
            ) : (
              <>
                {selected.route.requiredEndingIds.length > 0 && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={ready}
                      onChange={(e) => setReady(e.target.checked)}
                    />
                    我已完成：
                    {selected.route.requiredEndingIds
                      .map(
                        (id) =>
                          selected.pack.endings.find((e) => e.id === id)
                            ?.safeLabel ?? id,
                      )
                      .join("、")}
                  </label>
                )}
                <button
                  className="button secondary"
                  disabled={
                    selected.pack.status === "withdrawn" ||
                    (selected.route.requiredEndingIds.length > 0 && !ready)
                  }
                  onClick={() =>
                    start(
                      selected.pack,
                      selected.route.id,
                      selected.route.requiredEndingIds,
                    )
                  }
                >
                  开始记录进度
                </button>
              </>
            )}
          </section>
          <SourceDetails pack={selected.pack} />
        </>
      )}
    </>
  );
}

function GuideTree({
  pack,
  routeId,
  session,
  save,
  complete,
  bookmark,
  onBookmark,
}: {
  pack: Pack;
  routeId: string;
  bookmark?: string;
  onBookmark?: (choiceId: string) => boolean;
  session?: Session;
  save?: (s: Session) => boolean;
  complete?: () => void;
}) {
  const [alternatives, setAlternatives] = useState(true);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState("");
  const [collapse, setCollapse] = useState(false);
  const [bookmarkMessage, setBookmarkMessage] = useState("");
  const treeRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (!focused) return;
    const node = treeRef.current?.querySelector<HTMLElement>(
      `[data-choice-id="${CSS.escape(focused)}"]`,
    );
    node?.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    node?.focus({ preventScroll: true });
  }, [focused]);
  function jump(id: string) {
    setCollapse(false);
    setFocused("");
    requestAnimationFrame(() => setFocused(id));
  }
  const route = pack.routes.find((r) => r.id === routeId)!;
  const path = useMemo(() => guidePath(pack, routeId), [pack, routeId]);
  const position = session ? replay(pack, session).position : undefined;
  const matches = useMemo(
    () => findGuideNodes(path.nodes, search),
    [path, search],
  );
  const savedNode = path.nodes.find(({ choice }) => choice.id === bookmark);
  const collapsible = path.nodes.filter(
    ({ choice }) =>
      session?.events.some((e) => e.choiceId === choice.id) &&
      !(position?.kind === "choice" && position.id === choice.id),
  ).length;
  return (
    <section className="guide" aria-label="路线树">
      <div className="guide-title">
        <div>
          <h2>{route.safeLabel} · 路线树</h2>
          <p>
            {pack.release.label} · {path.nodes.length} 个攻略步骤
          </p>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={alternatives}
            onChange={(e) => setAlternatives(e.target.checked)}
          />
          显示其他选项
        </label>
      </div>
      <RouteBrief pack={pack} routeId={routeId} />
      <div className="guide-feedback">
        <GuideFeedback pack={pack} routeId={routeId} />
        <span>
          跳转 GitHub，需要 GitHub
          账号；提交后公开显示。仅预填攻略信息，不附带本机记录。
        </span>
      </div>
      <p>
        按路线起点和前置条件进入，再依次选择高亮选项。其他目标请在上方切换。
      </p>
      <div className="tree-root">
        {route.requiredEndingIds.length
          ? `前置：${route.requiredEndingIds.map((id) => pack.endings.find((e) => e.id === id)?.safeLabel ?? id).join("、")} → `
          : ""}
        路线起点
      </div>
      {session && (
        <div className="tracking-bar">
          <strong>
            已记录 {session.events.length} 次选择
            {session.completed ? " · 已通关" : ""}
          </strong>
          <button
            className="text-button"
            disabled={!session.events.length}
            onClick={() => save?.(undo(session) as Session)}
          >
            撤销上一步
          </button>
        </div>
      )}
      {position?.kind === "unknown" && (
        <Notice>
          实际选择已偏离本攻略路径，后续未收录。下面仍是从篇章开头出发的目标攻略；请回档后撤销上一步，再继续记录。
        </Notice>
      )}
      <div className="guide-finder" aria-label="定位攻略步骤">
        <label htmlFor="guide-search">查找日期或选项</label>
        <input
          id="guide-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="例如：12/24、求婚"
        />
        {search.trim() && (
          <>
            <p role="status">
              找到 {matches.length} 个步骤；点击结果定位，路线顺序保持不变。
            </p>
            <ul className="guide-results">
              {matches.map(
                (match: {
                  id: string;
                  index: number;
                  locator: string;
                  prompt: string;
                }) => (
                  <li key={match.id}>
                    <button
                      className="text-button"
                      onClick={() => jump(match.id)}
                    >
                      第 {match.index + 1} 步 · {match.locator} · {match.prompt}
                    </button>
                  </li>
                ),
              )}
            </ul>
          </>
        )}
        <div className="guide-shortcuts">
          {savedNode && (
            <button
              className="button secondary"
              onClick={() => jump(savedNode.choice.id)}
            >
              回到阅读书签：{savedNode.choice.locator}
            </button>
          )}
          {position?.kind === "choice" && (
            <button
              className="button secondary"
              onClick={() => jump(position.id)}
            >
              定位当前记录位置
            </button>
          )}
          {collapsible > 0 && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={collapse}
                onChange={(e) => setCollapse(e.target.checked)}
              />
              折叠已记录步骤（{collapsible}）
            </label>
          )}
        </div>
        <p className="small-note">
          阅读书签只标记看到的位置，不代表已选择或通关；保存在当前浏览器，可随备份导出。
        </p>
        <p role="status">{bookmarkMessage}</p>
      </div>
      <ol className="route-tree" ref={treeRef}>
        {path.nodes.map(({ choice, optionId }, i) => {
          const current =
            position?.kind === "choice" && position.id === choice.id;
          const event = session?.events.find((e) => e.choiceId === choice.id);
          return (
            <li
              className={`tree-step ${current ? "current" : ""} ${focused === choice.id ? "located" : ""}`}
              data-choice-id={choice.id}
              tabIndex={-1}
              hidden={collapse && !!event && !current}
              key={choice.id}
            >
              <div className="tree-date">
                <span>{i + 1}</span>
                <strong>{choice.locator}</strong>
                {current && <b>当前记录位置</b>}
                {event && <b>已记录</b>}
              </div>
              <p className="tree-prompt">{choice.prompt}</p>
              {onBookmark && (
                <button
                  className="text-button reading-bookmark"
                  aria-pressed={bookmark === choice.id}
                  onClick={() => {
                    if (onBookmark(choice.id))
                      setBookmarkMessage(
                        `已保存阅读书签：第 ${i + 1} 步 · ${choice.locator}`,
                      );
                  }}
                >
                  {bookmark === choice.id ? "阅读书签在这里" : "标记读到这里"}
                </button>
              )}
              <GuideFeedback
                pack={pack}
                routeId={routeId}
                choiceId={choice.id}
              />
              {choice.optionsComplete === false && (
                <p className="small-note">
                  仅列出已核对的目标选项，请按含义对照游戏。
                </p>
              )}
              <div
                className={`tree-branches ${alternatives ? "" : "only-target"}`}
              >
                {choice.options.map(
                  (
                    option: Pack["choices"][number]["options"][number],
                    index: number,
                  ) =>
                    (alternatives || option.id === optionId) && (
                      <div
                        key={option.id}
                        className={`tree-option ${option.id === optionId ? "target-option" : "other-option"}`}
                      >
                        <span className="branch-label">
                          {option.id === optionId
                            ? "按此路径选择"
                            : option.next.kind === "ending" &&
                                option.next.id === path.destination.id
                              ? "也可到达此结局"
                              : "其他选法 · 不在当前路径展开"}
                        </span>
                        <strong>
                          {choice.kind !== "instruction" &&
                          choice.orderKnown !== false
                            ? `第 ${index + 1} 项：`
                            : ""}
                          {option.text}
                        </strong>
                        {event?.optionId === option.id && (
                          <small>你的选择</small>
                        )}
                        {current && !session?.completed && (
                          <button
                            className="button secondary"
                            onClick={() =>
                              save?.(
                                recordChoice(
                                  pack,
                                  session!,
                                  option.id,
                                ) as Session,
                              )
                            }
                          >
                            {choice.kind === "instruction"
                              ? "我已完成这一步"
                              : choice.orderKnown === false
                                ? `我选择了：${option.text}`
                                : `我在游戏中选了第 ${index + 1} 项`}
                          </button>
                        )}
                      </div>
                    ),
                )}
              </div>
              {choice.skipTo && (
                <p className="small-note">
                  不同周目下可能不出现此选择；以游戏实际画面为准。
                  {current && (
                    <button
                      className="text-button"
                      onClick={() => {
                        if (window.confirm("确认游戏中没有出现此选择？"))
                          save?.(skipChoice(pack, session!) as Session);
                      }}
                    >
                      这一步未出现，跳过记录
                    </button>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="tree-ending">
        {path.destination.kind === "ending"
          ? `目标结局：${pack.endings.find((e) => e.id === path.destination.id)?.safeLabel}`
          : "后续规则不足，无法展开完整路线"}
        {position?.kind === "ending" && !session?.completed && (
          <>
            <p>选项已记录完，实际看到结局后再确认通关。</p>
            <button className="button primary" onClick={complete}>
              我已在游戏中通关
            </button>
          </>
        )}
      </div>
    </section>
  );
}
function PlayView({
  library,
  bookmarkRoute,
  pack,
  session,
  save,
  complete,
  back,
}: {
  pack: Pack;
  session: Session;
  save: (s: Session) => boolean;
  complete: () => void;
  back: () => void;
  notify: (s: string) => void;
  library: Library;
  bookmarkRoute: (pack: Pack, routeId: string, choiceId: string) => boolean;
}) {
  return (
    <>
      <button className="back-link" onClick={back}>
        <ArrowLeft size={16} />
        返回篇章与结局选择
      </button>
      <GuideTree
        pack={pack}
        routeId={session.routeId}
        bookmark={
          library.bookmarks?.find(
            (b) => b.packKey === packKey(pack) && b.routeId === session.routeId,
          )?.choiceId
        }
        onBookmark={(choiceId) =>
          bookmarkRoute(pack, session.routeId, choiceId)
        }
        session={session}
        save={save}
        complete={complete}
      />
      <SourceDetails pack={pack} />
    </>
  );
}
