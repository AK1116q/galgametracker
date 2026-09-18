import { ArrowUpRight } from "@phosphor-icons/react";
import { guideFeedbackUrl } from "../core/feedback.mjs";
import type { Pack } from "./types";

export default function GuideFeedback({
  pack,
  routeId,
  choiceId,
}: {
  pack: Pack;
  routeId: string;
  choiceId?: string;
}) {
  return (
    <a
      className="feedback-link"
      href={guideFeedbackUrl(pack, routeId, choiceId)}
      target="_blank"
      rel="noreferrer"
      title="前往 GitHub 填写公开反馈，需要 GitHub 账号"
    >
      {choiceId ? "反馈此步骤" : "反馈这条攻略"}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}
