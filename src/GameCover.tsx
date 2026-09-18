import { useState } from "react";
import covers from "./covers.json";

export default function GameCover({
  gameId,
  title,
  priority = false,
}: {
  gameId: string;
  title: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const cover = covers[gameId as keyof typeof covers];
  return (
    <div className="book-cover artwork-cover">
      {cover && !failed ? (
        <img
          src={cover.src}
          alt={`${title} 游戏封面`}
          width={cover.width}
          height={cover.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="cover-fallback">{title}</span>
      )}
    </div>
  );
}

export function CoverSources() {
  return (
    <details className="cover-sources">
      <summary>封面来源：Bangumi</summary>
      <ul>
        {Object.entries(covers).map(([id, cover]) => (
          <li key={id}>
            <a href={cover.source} target="_blank" rel="noreferrer">
              {cover.subjectTitle}
            </a>
          </li>
        ))}
      </ul>
      <p>封面版权归各作品权利人所有。</p>
    </details>
  );
}
