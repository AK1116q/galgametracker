import type { Pack } from "./types";
import { routeIssues, stepSources } from "../core/evidence.mjs";

export default function StepEvidence({
  pack,
  routeId,
  choiceId,
}: {
  pack: Pack;
  routeId: string;
  choiceId: string;
}) {
  const issues = routeIssues(pack, routeId, choiceId);
  const sources: {
    source: Pack["sources"][number] | undefined;
    locator: string;
  }[] = stepSources(pack, routeId, choiceId);
  return (
    <div className="step-evidence">
      {issues.map((issue) => (
        <p className="evidence-warning" key={issue.id}>
          <strong>待核验：</strong>
          {issue.summary}
        </p>
      ))}
      <details>
        <summary>此步骤的依据{issues.length ? "与争议" : ""}</summary>
        {sources.map(({ source, locator }, i) => (
          <p key={i}>
            {source && /^https:\/\//.test(source.reference) ? (
              <a href={source.reference} target="_blank" rel="noreferrer">
                {source.id} · 查看来源
              </a>
            ) : (
              source?.reference
            )}
            <span className="evidence-locator">文内位置：{locator}</span>
          </p>
        ))}
        {issues.map((issue) => (
          <section key={issue.id}>
            <h4>
              {issue.title} · 补充核对 {issue.checkedAt}
            </h4>
            {issue.evidence.map((e, i) => (
              <p key={i}>
                <a href={e.url} target="_blank" rel="noreferrer">
                  {e.label}
                </a>{" "}
                · {e.locator}
                <span className="evidence-locator">{e.finding}</span>
                {"quote" in e && <q>{e.quote}</q>}
              </p>
            ))}
            <p>仍需：{issue.next}</p>
          </section>
        ))}
        <p className="small-note">
          原网页可能含后续剧情。资料链接不代表本站已经实机验证；多份资料也可能同源。
        </p>
      </details>
    </div>
  );
}
