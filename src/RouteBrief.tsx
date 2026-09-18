import VersionScope from "./VersionScope";
import type { Pack } from "./types";
import { reviewInfo } from "../core/guide-info.mjs";
import { routeIssues, editorial } from "../core/evidence.mjs";

export default function RouteBrief({
  pack,
  routeId,
  onJump,
}: {
  pack: Pack;
  routeId: string;
  onJump: (id: string) => void;
}) {
  const route = pack.routes.find((r) => r.id === routeId)!;
  const review = reviewInfo(pack, routeId);
  const issues = routeIssues(pack, routeId);
  return (
    <section className="route-brief" aria-label="攻略使用条件">
      <div className="brief-heading">
        <h3>开始前确认</h3>
        <button
          className="button secondary"
          onClick={() => onJump(route.entryChoiceId)}
        >
          直接看步骤
        </button>
      </div>
      <dl>
        <div>
          <dt>适用版本</dt>
          <dd>{pack.release.label}。中文为含义提示，未确认具体汉化补丁。</dd>
        </div>
        <div>
          <dt>核验状态</dt>
          <dd>{review.label}</dd>
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
              : "未列出前置结局；额外周目限制见版本与存档说明。"}
          </dd>
        </div>
      </dl>
      {issues.length > 0 && (
        <div className="brief-alerts">
          {issues.map((issue) => (
            <p key={issue.id}>
              <strong>待核验：{issue.title}。</strong>
              <button
                className="text-button"
                onClick={() => onJump(issue.choiceIds[0])}
              >
                查看对应步骤
              </button>
            </p>
          ))}
        </div>
      )}
      <VersionScope pack={pack} />
      {!!pack.notes?.length && (
        <details className="route-notes">
          <summary>周目、存档及其他说明</summary>
          <p>
            从完整路径的起点进入；中途读档时，前面的选择也须符合本路径。外部攻略的
            Save 编号不代表你的存档。
          </p>
          <ul>
            {pack.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
      <details className="route-evidence">
        <summary>来源与核对记录 · {review.date}</summary>
        <p>{review.sourceCount} 个公开来源。链接数量不代表独立证据数量。</p>
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
      {issues.length > 0 && (
        <details className="maintenance-status">
          <summary>
            维护进度 · {issues.filter((i) => i.status === "open").length}{" "}
            项待核验
          </summary>
          <ul>
            {issues.map((issue) => (
              <li key={issue.id}>
                <strong>{issue.title}：待核验</strong>
                <p>{issue.next}</p>
                <small>最后复查：{issue.checkedAt}</small>
              </li>
            ))}
          </ul>
          {editorial.changes.map((change, i) => (
            <p key={i}>
              {change.date} · {change.scope}：{change.text}
            </p>
          ))}
          <a
            href="https://github.com/AK1116q/galgametracker/issues"
            target="_blank"
            rel="noreferrer"
          >
            查看公开反馈处理进度
          </a>
        </details>
      )}
    </section>
  );
}
