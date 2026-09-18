import type { Pack } from "./types";
import { reviewInfo } from "../core/guide-info.mjs";

export default function RouteBrief({
  pack,
  routeId,
}: {
  pack: Pack;
  routeId: string;
}) {
  const route = pack.routes.find((r) => r.id === routeId)!;
  const review = reviewInfo(pack, routeId);
  const entry = pack.choices.find((c) => c.id === route.entryChoiceId);
  return (
    <section className="route-brief" aria-label="攻略使用条件">
      <h3>开始前确认</h3>
      <dl>
        <div>
          <dt>适用版本</dt>
          <dd>{pack.release.label}</dd>
        </div>
        <div>
          <dt>核验状态</dt>
          <dd>{review.label}</dd>
        </div>
        <div>
          <dt>最近核对</dt>
          <dd>
            {review.date} · {review.sourceCount} 个公开来源
          </dd>
        </div>
        <div>
          <dt>前置结局</dt>
          <dd>
            {route.requiredEndingIds.length
              ? route.requiredEndingIds
                  .map(
                    (id) =>
                      pack.endings.find((e) => e.id === id)?.safeLabel ?? id,
                  )
                  .join("；")
              : "本路线未列出前置结局；篇章入口及周目限制见下方说明。"}
          </dd>
        </div>
        <div>
          <dt>路线起点</dt>
          <dd>
            {entry?.locator} · {entry?.prompt}
          </dd>
        </div>
        <div>
          <dt>存档与入口</dt>
          <dd>
            按下方完整路径的起点进入。外部攻略中的 Save
            编号不代表你的存档；从中途读档时，之前的选择也必须符合本路径。
          </dd>
        </div>
      </dl>
      {!!pack.notes?.length && (
        <details className="route-notes" open>
          <summary>版本、周目与存档说明</summary>
          <ul>
            {pack.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
      <details className="route-evidence">
        <summary>核对依据与来源</summary>
        <ul>
          {pack.sources.map((source) => (
            <li key={source.id}>
              {/^https:\/\//.test(source.reference) ? (
                <a href={source.reference} target="_blank" rel="noreferrer">
                  {source.id} · {new URL(source.reference).hostname}
                </a>
              ) : (
                source.reference
              )}
            </li>
          ))}
        </ul>
        {pack.reviews
          .filter((r) => r.routeIds.includes(routeId))
          .map((r, i) => (
            <p key={i}>
              {r.date} · {r.evidence}
            </p>
          ))}
        <p>资料核对和网站自动化测试都不等于实际游戏通关。</p>
      </details>
    </section>
  );
}
