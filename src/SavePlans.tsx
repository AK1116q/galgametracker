import plans from "../data/editorial/save-plans.json";
import type { Pack } from "./types";
export default function SavePlans({
  pack,
  routeId,
  onJump,
}: {
  pack: Pack;
  routeId: string;
  onJump: (id: string) => void;
}) {
  const selected = plans.filter((p) =>
    p.targets.some(
      (t) =>
        t.packKey === `${pack.id}@${pack.revision}` && t.routeId === routeId,
    ),
  );
  if (!selected.length) return null;
  return (
    <details className="save-plans">
      <summary>多结局存档规划 · {selected.length} 个可用存档点</summary>
      <p>
        以下是游戏内手动存档安排，本站书签不会创建游戏存档。仅核对了资料和前序路径，未实机验证。
      </p>
      {selected.map((plan) => (
        <section key={plan.id}>
          <h3>{plan.title}</h3>
          <p>
            <strong>保存位置：{plan.checkpoint}</strong>
          </p>
          <ol>
            {plan.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
          <button
            className="text-button"
            onClick={() =>
              onJump(
                plan.targets.find(
                  (t) =>
                    t.packKey === `${pack.id}@${pack.revision}` &&
                    t.routeId === routeId,
                )!.choiceId,
              )
            }
          >
            定位存档前的选择
          </button>
          <p>
            可切换目标：
            {plan.targets.map((t, i) => (
              <span key={t.routeId}>
                {i > 0 && " / "}
                <a
                  href={`/?${new URLSearchParams({ view: "game", game: plan.gameId, chapter: plan.chapter, target: `${t.packKey}/${t.routeId}` })}`}
                >
                  {t.label}
                </a>
              </span>
            ))}
          </p>
          <small>
            <a href={plan.source} target="_blank" rel="noreferrer">
              来源
            </a>{" "}
            · {plan.sourceLocator} · 核对 {plan.checkedAt}
          </small>
        </section>
      ))}
    </details>
  );
}
