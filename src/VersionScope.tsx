import type { Pack } from "./types";
import { editorial } from "../core/evidence.mjs";
export default function VersionScope({ pack }: { pack: Pack }) {
  return (
    <details className="version-scope">
      <summary>版本适用范围与汉化说明</summary>
      {pack.game.id === "white-album-2" ? (
        <ul>
          {editorial.wa2Versions.map((v) => (
            <li key={v.label}>
              <strong>
                {v.label}：{v.status}
              </strong>
              <p>
                {v.note}
                {v.url && (
                  <>
                    {" "}
                    <a href={v.url} target="_blank" rel="noreferrer">
                      依据
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          当前资料基准：{pack.release.label}
          。尚无逐补丁的实机适配记录；其他平台或重制版不能视为已验证兼容。
        </p>
      )}
      <p>
        请在游戏标题画面、版本说明或补丁说明中确认版本。若选项不一致，反馈时附上平台、版本号及补丁名称。
      </p>
    </details>
  );
}
