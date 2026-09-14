import { useEffect, useRef, useState } from "react";
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
  Plus,
  MagnifyingGlass,
  ShieldCheck,
  Check,
  CheckCircle,
  CaretRight,
  DownloadSimple,
  UploadSimple,
  Clock,
  ArrowCounterClockwise,
  WarningCircle,
  X,
  Trash,
  FloppyDisk,
  FileText,
  PencilSimple,
  FolderOpen,
  DotsThree,
  List,
} from "@phosphor-icons/react";
import {
  createSession,
  replay,
  recommend,
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
import { validatePack } from "../core/validation.mjs";
import { makeDraft, draftToPack } from "../core/editor.mjs";
import demoData from "../data/examples/demo.route.json";
import wa2Data from "../data/wa2/setsuna-cc.route.json";
import type { Pack, Session, Library, Draft } from "./types";

const BUILTINS = [wa2Data, demoData] as Pack[];
type View = "library" | "game" | "play" | "records" | "editor" | "settings";
const statusText = (p: Pack) =>
  p.synthetic
    ? "体验用虚构示例"
    : p.status === "source_checked"
      ? "资料已核对 · 待实机"
      : p.status === "verified"
        ? "已实机核对"
        : p.status === "withdrawn"
          ? "已撤回"
          : "私人草稿";
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
  const [view, setView] = useState<View>("library");
  const [gameId, setGameId] = useState("white-album-2");
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const d = localStorage.getItem("galgametracker.draft");
      if (d) {
        const p = JSON.parse(d);
        if (
          typeof p.title === "string" &&
          Array.isArray(p.steps) &&
          p.steps.every((s: Draft["steps"][0]) => Array.isArray(s.options))
        )
          return p;
      }
    } catch {}
    return makeDraft();
  });
  const importRef = useRef<HTMLInputElement>(null);
  const packs = [
    ...BUILTINS,
    ...library.packs.filter(
      (p) => !BUILTINS.some((b) => packKey(b) === packKey(p)),
    ),
  ];
  const allGames = [...new Map(packs.map((p) => [p.game.id, p.game])).values()];
  const selectedPacks = packs.filter((p) => p.game.id === gameId);
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
    document.title = `${{ library: "游戏库", game: "路线选择", play: "路线导航", records: "游玩记录", editor: "攻略工作台", settings: "数据与设置" }[view]} · 路线手记`;
  }, [view]);

  function navigate(next: View) {
    setView(next);
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
    setActiveId(session.id);
    navigate("play");
  }
  function openGame(id: string) {
    setGameId(id);
    navigate("game");
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
        setToast("这段旅程，已经收进手记。");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  function saveDraft(next: Draft) {
    setDraft(next);
    try {
      localStorage.setItem("galgametracker.draft", JSON.stringify(next));
    } catch {
      setToast("草稿无法自动保存，请检查浏览器存储空间。");
    }
  }
  function addDraft() {
    try {
      const pack = draftToPack(draft) as Pack;
      const errors = validatePack(pack);
      if (errors.length) throw new Error(errors[0]);
      if (commit({ ...library, packs: [...library.packs, pack] })) {
        setToast("已保存为私人攻略，可以开始检查路线。");
        openGame(pack.game.id);
      }
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
    download(`路线手记-${new Date().toISOString().slice(0, 10)}.json`, {
      ...library,
      packs,
    });
  }

  const nav = [
    { id: "library" as View, label: "我的游戏库", Icon: BookOpen },
    { id: "play" as View, label: "路线导航", Icon: Compass },
    { id: "records" as View, label: "游玩记录", Icon: Notebook },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button className="brand" onClick={() => navigate("library")}>
          <span className="brand-mark">
            <BookmarkSimple size={23} weight="fill" />
          </span>
          <span>
            路线手记<small>ROUTE NOTES</small>
          </span>
        </button>
        <div className="sidebar-label">我的空间</div>
        <nav aria-label="主导航">
          {nav.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id || (id === "library" && view === "game") ? "active" : ""}`}
              onClick={() => {
                if (id === "play" && !active && recent) setActiveId(recent.id);
                navigate(id);
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
          className={`nav-item ${view === "editor" ? "active" : ""}`}
          onClick={() => navigate("editor")}
        >
          <PencilSimple size={20} />
          攻略工作台
        </button>
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
            <strong>这份手记，属于你</strong>
            <p>
              记录保存在当前浏览器。
              <br />
              偶尔导出一份，安心继续。
            </p>
            <button className="text-button" onClick={backup}>
              备份我的记录
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="sidebar-version">
            <span>独自游玩，也有陪伴。</span>
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
            <span>我的空间</span>
            <CaretRight size={12} />
            <strong>
              {
                {
                  library: "游戏库",
                  game: "游戏详情",
                  play: "路线导航",
                  records: "游玩记录",
                  editor: "攻略工作台",
                  settings: "数据与设置",
                }[view]
              }
            </strong>
          </div>
          <span className="topbar-right">
            <ShieldCheck size={16} />
            默认无剧透<span className="avatar">我</span>
          </span>
        </header>
        <main
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
                  download("路线手记-原始数据.json", { raw });
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
                  <h1>故事，慢慢读。</h1>
                  <p>记住走过的路，把未知留给下一次选择。</p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => navigate("editor")}
                >
                  <Plus size={17} />
                  录入攻略
                </button>
              </div>
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
                  .map((g) => (
                    <button
                      key={g.id}
                      className="game-card"
                      onClick={() => openGame(g.id)}
                    >
                      <div
                        className={`book-cover ${g.id !== "white-album-2" ? "custom-cover" : ""}`}
                      >
                        <div className="cover-top">
                          <span>VISUAL NOVEL</span>
                          <BookmarkSimple size={19} />
                        </div>
                        <div className="cover-title">
                          {g.id === "white-album-2" ? (
                            <>
                              <span>WHITE</span>
                              <span>
                                ALBUM <i>2</i>
                              </span>
                            </>
                          ) : (
                            <span>{g.title}</span>
                          )}
                        </div>
                        <div className="cover-line" />
                        <div className="cover-bottom">
                          <span>
                            {g.id === "white-album-2"
                              ? "白色相簿2"
                              : "我的路线收藏"}
                          </span>
                          <span>
                            {g.id === "white-album-2"
                              ? "Leaf / AQUAPLUS"
                              : "PERSONAL GUIDE"}
                          </span>
                        </div>
                      </div>
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
                            {g.id === "white-album-2"
                              ? "资料已核对"
                              : "私人攻略"}
                          </span>
                          <span>
                            打开手记
                            <ArrowRight size={14} />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                {filter === "all" && !query && (
                  <button
                    className="add-game-card"
                    onClick={() => navigate("editor")}
                  >
                    <span className="add-square">
                      <Plus size={25} />
                    </span>
                    <h3>下一段故事</h3>
                    <p>
                      把你的攻略整理成路线，
                      <br />
                      下次游玩时，从容一点。
                    </p>
                    <span className="text-button">
                      添加自己的攻略
                      <ArrowUpRight size={15} />
                    </span>
                  </button>
                )}
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
              <div className="library-footer">
                <p>
                  <ShieldCheck size={17} />
                  只在你需要时，告诉你下一步。
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
          {view === "game" && (
            <GameView
              key={gameId}
              packs={selectedPacks}
              library={library}
              start={start}
              resume={resume}
              back={() => navigate("library")}
              edit={() => navigate("editor")}
            />
          )}
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
              />
            ) : (
              <Empty
                title="还没有正在导航的路线"
                text="先选一部游戏和目标角色，我们只展示你当前需要的选择。"
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
                  <h1>走过的路，都记得。</h1>
                  <p>每一次选择，都是这段故事的书签。</p>
                </div>
                <button className="button secondary" onClick={backup}>
                  <DownloadSimple size={17} />
                  导出备份
                </button>
              </div>
              <div className="record-summary">
                <div>
                  <strong>{library.sessions.length}</strong>
                  <span>段游玩记录</span>
                </div>
                <div>
                  <strong>{ongoing.length}</strong>
                  <span>段故事进行中</span>
                </div>
                <div>
                  <strong>{library.completed.length}</strong>
                  <span>个结局已确认</span>
                </div>
              </div>
              {!library.sessions.length ? (
                <Empty
                  title="第一张书签，还在等你"
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
          {view === "editor" && (
            <Editor
              draft={draft}
              change={saveDraft}
              save={addDraft}
              importData={() => importRef.current?.click()}
              saved={library.packs}
              notify={setToast}
            />
          )}
          {view === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MAKE YOURSELF AT HOME</div>
                  <h1>安心存好，再继续。</h1>
                  <p>不需要注册，记录也能一直陪着你。</p>
                </div>
              </div>
              <section className="settings-section">
                <div className="settings-icon">
                  <FolderOpen size={26} />
                </div>
                <div>
                  <h2>你的浏览器，就是你的书架</h2>
                  <p>
                    游玩记录和私人攻略仅保存在当前浏览器，不会上传到服务器。换设备、换网址或清除浏览器数据前，请先导出备份。
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
                  <h2>无剧透，是默认设置</h2>
                  <p>
                    导航只显示当前选择。未来选项与结局详情不会提前出现在页面中。攻略工作台和外部来源包含完整路线，请在准备好时再打开。
                  </p>
                </div>
              </section>
              <section className="settings-section">
                <div className="settings-icon">
                  <FileText size={26} />
                </div>
                <div>
                  <h2>关于路线手记</h2>
                  <p>
                    一个面向小规模中文 Galgame
                    玩家的非官方工具。首批收录《白色相簿2》雪菜 CC
                    路线，资料已核对，仍待实机检查。游戏名称权利属于其权利人。
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
          <span>路线手记</span>
          <span>让攻略止步于此，让故事继续。</span>
          <span>LOCAL FIRST · v0.1</span>
        </footer>
      </div>
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

function GameView({
  packs,
  library,
  start,
  resume,
  back,
  edit,
}: {
  packs: Pack[];
  library: Library;
  start: (p: Pack, r: string, e: string[]) => void;
  resume: (s: Session) => void;
  back: () => void;
  edit: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState(packKey(packs[0]));
  const [confirmed, setConfirmed] = useState(false);
  const [checked, setChecked] = useState(false);
  const pack = packs.find((p) => packKey(p) === selectedKey) ?? packs[0];
  const completed = library.completed
    .filter((e) => e.packKey === packKey(pack))
    .map((e) => e.endingId);
  return (
    <>
      <button className="back-link" onClick={back}>
        <ArrowLeft size={16} />
        返回游戏库
      </button>
      <div className="game-heading">
        <div className="mini-cover">
          <span>
            {pack.synthetic ? "DEMO" : "WA"}
            <b>{pack.synthetic ? "01" : "2"}</b>
          </span>
        </div>
        <div>
          <div className="eyebrow">
            {pack.synthetic ? "FICTIONAL EXAMPLE" : "WHITE ALBUM 2"}
          </div>
          <h1>{pack.game.title}</h1>
          <p>
            {pack.synthetic
              ? "先用两次选择，体验记录、撤销与恢复。"
              : "选择目标，把接下来的故事留在游戏里。"}
          </p>
          <span className={`badge ${pack.synthetic ? "" : "blue"}`}>
            {statusText(pack)}
          </span>
        </div>
      </div>
      <div className="detail-grid">
        <section>
          <div className="section-title">
            <h2>开始哪一条路线？</h2>
            <span>{pack.routes.length} 条已收录</span>
          </div>
          <label className="field version-field">
            我的游戏版本
            <select
              value={selectedKey}
              onChange={(e) => {
                setSelectedKey(e.target.value);
                setChecked(false);
                setConfirmed(false);
              }}
            >
              {packs.map((p) => (
                <option key={packKey(p)} value={packKey(p)}>
                  {p.release.label} · v{p.revision}
                </option>
              ))}
            </select>
          </label>
          {!pack.synthetic && (
            <div className="version-explain">
              <p>
                内置文本是<strong>选项含义提示</strong>
                ，并非特定汉化原文。请核对你画面里的顺序与含义；不要只按序号盲选。
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                我了解版本说明，会对照游戏画面核对
              </label>
            </div>
          )}
          {pack.routes.map((route) => {
            const missing = route.requiredEndingIds.filter(
              (id) => !completed.includes(id),
            );
            const previous = [...library.sessions]
              .reverse()
              .find(
                (s) =>
                  sessionPackKey(s) === packKey(pack) &&
                  s.routeId === route.id &&
                  !s.completed,
              );
            return (
              <div className="route-card" key={route.id}>
                <div className="route-emblem">
                  {pack.synthetic ? "试" : "雪"}
                </div>
                <div className="route-copy">
                  <div className="eyebrow">
                    {pack.synthetic ? "DEMO ROUTE" : "CLOSING CHAPTER"}
                  </div>
                  <h3>{route.safeLabel}</h3>
                  <p>
                    {pack.synthetic
                      ? "虚构演示，不是真实游戏攻略。"
                      : "从 CC 开头开始 · 一次只看当前选择"}
                  </p>
                  {missing.length > 0 && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      我已完成：
                      {missing
                        .map(
                          (id) =>
                            pack.endings.find((e) => e.id === id)?.safeLabel,
                        )
                        .join("、")}
                    </label>
                  )}
                  <div className="button-row">
                    {previous && (
                      <button
                        className="button primary"
                        onClick={() => resume(previous)}
                      >
                        继续已有记录
                        <ArrowRight size={16} />
                      </button>
                    )}
                    <button
                      className={`button ${previous ? "secondary" : "primary"}`}
                      disabled={
                        (!pack.synthetic && !checked) ||
                        (missing.length > 0 && !confirmed) ||
                        pack.status === "withdrawn"
                      }
                      onClick={() =>
                        start(pack, route.id, [
                          ...new Set([
                            ...completed,
                            ...(confirmed ? missing : []),
                          ]),
                        ])
                      }
                    >
                      {previous ? "另开一次游玩" : "开始这条路线"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!pack.synthetic && (
            <div className="understated-note">
              <Plus size={18} />
              <span>想整理另一条路线？</span>
              <button className="text-button" onClick={edit}>
                去攻略工作台
              </button>
            </div>
          )}
        </section>
        <aside className="detail-aside">
          <span className="eyebrow">BEFORE YOU BEGIN</span>
          <h3>只看眼前这一步。</h3>
          <ol>
            <li>
              <strong>先在游戏里遇到选项</strong>
              <p>再回来核对当前提示。</p>
            </li>
            <li>
              <strong>记录你实际选择的内容</strong>
              <p>选错了也没关系，回档后可以撤销。</p>
            </li>
            <li>
              <strong>下次回来，接着读</strong>
              <p>每一次确认都会保存在本机。</p>
            </li>
          </ol>
          <ShieldCheck size={25} weight="duotone" />
        </aside>
      </div>
      <SourceDetails pack={pack} />
    </>
  );
}

function PlayView({
  pack,
  session,
  save,
  complete,
  back,
  notify,
}: {
  pack: Pack;
  session: Session;
  save: (s: Session) => boolean;
  complete: () => void;
  back: () => void;
  notify: (s: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [encountered, setEncountered] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const { position } = replay(pack, session);
  const choice = pack.choices.find((c) => c.id === position.id);
  const recommendation = recommend(pack, session);
  const route = pack.routes.find((r) => r.id === session.routeId)!;
  useEffect(() => {
    setSelected("");
    setEncountered(false);
    setMismatch(false);
    setShowTitle(false);
  }, [session.events.length, position.id]);
  function act() {
    try {
      if (save(recordChoice(pack, session, selected) as Session))
        notify("选择已保存。按自己的节奏继续。");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <div className="play-heading">
        <button className="back-link" onClick={back}>
          <ArrowLeft size={16} />
          {pack.game.title}
        </button>
        <span className="badge green">
          <ShieldCheck size={14} />
          无剧透导航
        </span>
      </div>
      <div className="navigator-grid">
        <aside className="journey-aside">
          <span className="eyebrow">YOUR ROUTE</span>
          <h2>{route.safeLabel}</h2>
          <p>{pack.release.label}</p>
          <div className="journey-stat">
            <strong>{String(session.events.length).padStart(2, "0")}</strong>
            <span>次选择已记录</span>
          </div>
          <div className="journey-bookmark">
            <BookmarkSimple size={21} />
            <span>
              本机已保存<small>{dateText(session.updatedAt)}</small>
            </span>
          </div>
          <button
            className="text-button undo-button"
            disabled={!session.events.length}
            onClick={() => {
              if (save(undo(session) as Session))
                notify("已撤销最后一次选择。请确认游戏也已回档。");
            }}
          >
            <ArrowCounterClockwise size={16} />
            撤销上一步
          </button>
          <p className="small-note">
            这里只记录关键选择，
            <br />
            不估算剧情完成百分比。
          </p>
        </aside>
        <section className="navigator-panel">
          {position.kind === "choice" && choice && (
            <>
              <div className="choice-top">
                <span className="eyebrow">CURRENT CHOICE</span>
                <span>{choice.locator}</span>
              </div>
              <h1>{encountered ? choice.prompt : "等故事走到这里。"}</h1>
              <p className="choice-intro">
                {encountered
                  ? pack.synthetic
                    ? "选择你实际点击的选项，再确认记录。"
                    : "以下为中文语义提示。先核对你看到的内容，再选择。"
                  : "在游戏里看到这个时间附近的选择后，再展开提示。"}
              </p>
              {!encountered ? (
                <div className="encounter-gate">
                  <Compass size={42} weight="duotone" />
                  <p>
                    先好好读故事，
                    <br />
                    需要做选择时再回来。
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setEncountered(true)}
                  >
                    我已遇到当前选择
                    <ArrowRight size={17} />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="option-list"
                    role="radiogroup"
                    aria-label="当前选项"
                  >
                    {choice.options.map((option, index) => (
                      <button
                        role="radio"
                        aria-checked={selected === option.id}
                        key={option.id}
                        className={`option ${selected === option.id ? "chosen" : ""} ${recommendation.optionIds.includes(option.id) ? "recommended" : ""}`}
                        onClick={() => setSelected(option.id)}
                      >
                        <span className="option-letter">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{option.text}</span>
                        {recommendation.optionIds.includes(option.id) && (
                          <span className="recommended-tag">
                            <Check size={14} />
                            推荐
                          </span>
                        )}
                        <span className="radio-circle">
                          {selected === option.id && <span />}
                        </span>
                      </button>
                    ))}
                  </div>
                  {recommendation.status !== "recommended" && (
                    <Notice>
                      当前历史不足或规则冲突，无法给出可靠推荐。可以记录实际选择，或回档检查。
                    </Notice>
                  )}
                  {selected &&
                    recommendation.status === "recommended" &&
                    !recommendation.optionIds.includes(selected) && (
                      <Notice>
                        这不是本路线推荐的选择。确认后会记录真实选择，并暂停未覆盖的后续导航。
                      </Notice>
                    )}
                  <div className="choice-actions">
                    <button
                      className="text-button"
                      onClick={() => setMismatch(!mismatch)}
                    >
                      我看到的选项不一样
                    </button>
                    <button
                      className="button primary"
                      disabled={!selected}
                      onClick={act}
                    >
                      确认，我选了这一项
                      <Check size={17} />
                    </button>
                  </div>
                  {mismatch && (
                    <Notice>
                      先暂停，不要按序号盲选。检查游戏版本、之前是否选了其他分支，或撤销回到上一步。你可以导出记录，在攻略工作台修订一份副本。
                    </Notice>
                  )}
                  {choice.skipTo && (
                    <div className="skip-choice">
                      <p>这一步在已通关后的周目可能不会出现。</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "请确认游戏已跳过此选择并继续推进。只跳过导航记录，不代表已经通关。",
                            )
                          )
                            save(skipChoice(pack, session) as Session);
                        }}
                      >
                        游戏没有出现这一步，继续记录
                      </button>
                    </div>
                  )}
                </>
              )}
              <div className="spoiler-promise">
                <ShieldCheck size={16} />
                不显示后续剧情，也不解释路线结果。
              </div>
            </>
          )}
          {position.kind === "unknown" && (
            <div className="end-state">
              <WarningCircle size={45} weight="duotone" />
              <span className="eyebrow">PAUSE & REPOSITION</span>
              <h1>先把书签留在这里。</h1>
              <p>
                你刚才的选择不在这份攻略覆盖的路径中。
                <br />
                我们已经保存了真实选择，不会猜测接下来的路线。
              </p>
              <button
                className="button primary"
                onClick={() => save(undo(session) as Session)}
              >
                <ArrowCounterClockwise size={17} />
                我已在游戏回档，撤销这次选择
              </button>
            </div>
          )}
          {position.kind === "ending" && (
            <div className="end-state">
              <CheckCircle size={48} weight="duotone" />
              <span className="eyebrow">
                {session.completed
                  ? "A CHAPTER TO KEEP"
                  : "THE STORY CONTINUES"}
              </span>
              <h1>
                {session.completed
                  ? "这一程，好好收下。"
                  : "剩下的时间，交给故事。"}
              </h1>
              <p>
                {session.completed
                  ? "这次通关已记录。你可以随时回来看，也可以开始新的旅程。"
                  : "关键选择已经记录完。请继续游玩，真正看到结局后，再确认完成。"}
              </p>
              {!session.completed && (
                <button className="button primary" onClick={complete}>
                  我已在游戏中通关
                  <Check size={17} />
                </button>
              )}
              <button
                className="text-button"
                onClick={() => setShowTitle(!showTitle)}
              >
                {showTitle ? "隐藏结局名称" : "展开结局名称（可能剧透）"}
              </button>
              {showTitle && (
                <strong>
                  {pack.endings.find((e) => e.id === position.id)?.hiddenTitle}
                </strong>
              )}
              {session.completed && (
                <button className="button secondary" onClick={back}>
                  返回路线选择
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      <SourceDetails pack={pack} />
    </>
  );
}

function Editor({
  draft,
  change,
  save,
  importData,
  saved,
  notify,
}: {
  draft: Draft;
  change: (d: Draft) => void;
  save: () => void;
  importData: () => void;
  saved: Pack[];
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState("write");
  const [jsonText, setJsonText] = useState("");
  const update = (key: keyof Draft, value: string) =>
    change({ ...draft, [key]: value });
  function updateStep(index: number, values: Partial<Draft["steps"][0]>) {
    change({
      ...draft,
      steps: draft.steps.map((s, i) => (i === index ? { ...s, ...values } : s)),
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE GUIDE WORKBENCH</div>
          <h1>把熟悉的路，整理好。</h1>
          <p>先录入一条完整路径，再在游戏中逐步核对。</p>
        </div>
        <button className="button secondary" onClick={importData}>
          <UploadSimple size={17} />
          导入路线文件
        </button>
      </div>
      <Notice>
        工作台包含完整选项。这里保存的是你自己的攻略，不会直接发布到公共游戏库。
      </Notice>
      <div className="tabs editor-tabs">
        {[
          ["write", "录入路线"],
          ["saved", "已保存的攻略"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "selected" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "write" ? (
        <div className="editor-layout">
          <div>
            <section className="editor-section">
              <div className="section-title">
                <h2>
                  <span className="section-num">01</span>游戏与来源
                </h2>
                <span>草稿自动保存在本机</span>
              </div>
              <div className="form-grid">
                <label className="field">
                  作品
                  <select
                    value={draft.gameId}
                    onChange={(e) =>
                      change({
                        ...draft,
                        gameId: e.target.value,
                        title:
                          e.target.value === "white-album-2" ? "白色相簿2" : "",
                      })
                    }
                  >
                    <option value="white-album-2">白色相簿2</option>
                    <option value="custom-game">其他作品</option>
                  </select>
                </label>
                {draft.gameId === "custom-game" && (
                  <label className="field">
                    游戏名称
                    <input
                      value={draft.title}
                      onChange={(e) => update("title", e.target.value)}
                    />
                  </label>
                )}
                <label className="field">
                  版本 / 汉化补丁
                  <input
                    placeholder="例如：PC 原版 · 我的汉化补丁名称"
                    value={draft.release}
                    onChange={(e) => update("release", e.target.value)}
                  />
                </label>
                <label className="field">
                  目标路线
                  <input
                    placeholder="例如：小木曾雪菜 · CC"
                    value={draft.route}
                    onChange={(e) => update("route", e.target.value)}
                  />
                </label>
                <label className="field">
                  结局记录名称
                  <input
                    placeholder="仅在玩家主动展开时显示"
                    value={draft.ending}
                    onChange={(e) => update("ending", e.target.value)}
                  />
                </label>
                <label className="field wide">
                  攻略来源
                  <input
                    placeholder="自己的游戏笔记，或攻略来源链接"
                    value={draft.source}
                    onChange={(e) => update("source", e.target.value)}
                  />
                </label>
                <label className="field wide">
                  使用依据
                  <input
                    placeholder="例如：本人逐步游玩记录 / 已获作者同意"
                    value={draft.permission}
                    onChange={(e) => update("permission", e.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className="editor-section">
              <div className="section-title">
                <h2>
                  <span className="section-num">02</span>关键选择
                </h2>
                <span>{draft.steps.length} 个节点</span>
              </div>
              <p className="section-description">
                按游戏中出现的顺序录入。每一步标记一个推荐选项；其他选择会暂停导航。
              </p>
              {draft.steps.map((step, i) => (
                <div className="step-editor" key={step.id}>
                  <div className="step-heading">
                    <strong>选择 {String(i + 1).padStart(2, "0")}</strong>
                    <div>
                      <button
                        className="text-button"
                        disabled={i === 0}
                        onClick={() => {
                          const steps = [...draft.steps];
                          [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
                          change({ ...draft, steps });
                        }}
                      >
                        上移
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`删除选择 ${i + 1}`}
                        disabled={draft.steps.length === 1}
                        onClick={() =>
                          change({
                            ...draft,
                            steps: draft.steps.filter(
                              (_, index) => i !== index,
                            ),
                          })
                        }
                      >
                        <Trash size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      时间 / 章节
                      <input
                        value={step.locator}
                        placeholder="例如：12 月 2 日"
                        onChange={(e) =>
                          updateStep(i, { locator: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      当前提示
                      <input
                        value={step.prompt}
                        placeholder="帮助辨认当前选项的短提示"
                        onChange={(e) =>
                          updateStep(i, { prompt: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  {step.options.map((text, j) => (
                    <div className="editor-option" key={j}>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name={`recommend-${step.id}`}
                          checked={step.recommended === j}
                          onChange={() => updateStep(i, { recommended: j })}
                          aria-label={`选择 ${i + 1} 推荐第 ${j + 1} 项`}
                        />
                        <span>{j + 1}</span>
                      </label>
                      <input
                        aria-label={`选择 ${i + 1} 选项 ${j + 1}`}
                        placeholder={`第 ${j + 1} 个选项的文本`}
                        value={text}
                        onChange={(e) =>
                          updateStep(i, {
                            options: step.options.map((o, index) =>
                              index === j ? e.target.value : o,
                            ),
                          })
                        }
                      />
                      <button
                        className="icon-button"
                        aria-label={`删除选择 ${i + 1} 的选项 ${j + 1}`}
                        disabled={step.options.length <= 2}
                        onClick={() =>
                          updateStep(i, {
                            options: step.options.filter(
                              (_, index) => index !== j,
                            ),
                            recommended:
                              step.recommended === j
                                ? 0
                                : step.recommended > j
                                  ? step.recommended - 1
                                  : step.recommended,
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                  <div className="step-footer">
                    <span>
                      <CheckCircle size={15} />
                      圆点选中的是推荐项
                    </span>
                    <button
                      className="text-button"
                      onClick={() =>
                        updateStep(i, { options: [...step.options, ""] })
                      }
                    >
                      <Plus size={15} />
                      添加选项
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="add-step"
                onClick={() =>
                  change({
                    ...draft,
                    steps: [
                      ...draft.steps,
                      {
                        id: crypto.randomUUID(),
                        locator: "",
                        prompt: "",
                        options: ["", ""],
                        recommended: 0,
                      },
                    ],
                  })
                }
              >
                <Plus size={18} />
                添加下一个关键选择
              </button>
            </section>
          </div>
          <aside className="editor-aside">
            <FloppyDisk size={27} weight="duotone" />
            <h3>先保存，再验证。</h3>
            <p>
              这份路径可以立即在本机试用。实际通关前，它会一直标为私人草稿。
            </p>
            <button className="button primary" onClick={save}>
              保存为私人攻略
              <ArrowRight size={16} />
            </button>
            <button
              className="button secondary"
              onClick={() => {
                try {
                  download("我的路线.route.json", draftToPack(draft));
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <DownloadSimple size={16} />
              导出路线文件
            </button>
            <small>
              当前表单支持顺序路线。复杂分支和前置条件可以通过路线文件导入。
            </small>
          </aside>
        </div>
      ) : (
        <>
          {saved.length ? (
            saved.map((p) => (
              <div className="saved-pack" key={packKey(p)}>
                <FileText size={23} />
                <div>
                  <strong>
                    {p.game.title} · {p.routes[0]?.safeLabel}
                  </strong>
                  <p>
                    {p.release.label} · {statusText(p)}
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => {
                    setJsonText(JSON.stringify(p, null, 2));
                  }}
                >
                  查看 / 修订
                </button>
                <button
                  className="icon-button"
                  aria-label={`导出 ${p.game.title}`}
                  onClick={() => download(`${p.id}.route.json`, p)}
                >
                  <DownloadSimple size={20} />
                </button>
              </div>
            ))
          ) : (
            <Empty
              title="还没有保存的私人攻略"
              text="内置攻略由网站统一维护；你录入或导入的副本会出现在这里。"
            />
          )}
          <div className="builtin-export">
            <span>需要修订内置《白色相簿2》路线？先导出一份副本。</span>
            <button
              className="text-button"
              onClick={() => {
                const p = structuredClone(wa2Data);
                p.id = `wa2-personal-${crypto.randomUUID().slice(0, 8)}`;
                p.status = "draft";
                p.reviews = [];
                download("白色相簿2-私人修订.route.json", p);
              }}
            >
              导出可修订副本
              <DownloadSimple size={16} />
            </button>
          </div>
          {jsonText && (
            <section className="json-editor">
              <label className="field">
                路线文件内容
                <textarea
                  rows={18}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  spellCheck={false}
                />
              </label>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => {
                    try {
                      const p = JSON.parse(jsonText);
                      const errors = validatePack(p);
                      if (errors.length) throw new Error(errors[0]);
                      download(`${p.id}.route.json`, p);
                      notify(
                        "文件已校验并导出。修改内容后请增加 revision，再导入到本机。",
                      );
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  校验并导出修订
                </button>
                <button className="text-button" onClick={() => setJsonText("")}>
                  关闭
                </button>
              </div>
              <p>
                修改已使用的攻略时，请增加 revision，旧存档会继续使用原版本。
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
