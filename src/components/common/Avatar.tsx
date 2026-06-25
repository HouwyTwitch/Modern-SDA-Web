import { useEffect, useState } from "react";
import { initials } from "../../lib/format";

interface Props {
  name: string;
  color: string;
  url?: string | null;
  size?: number;
}

/** Account avatar: shows the Steam profile image, falling back to initials. */
export function Avatar({ name, color, url, size = 44 }: Props) {
  const [failed, setFailed] = useState(false);
  // Reset the error state when the URL changes (avatars are backfilled async).
  useEffect(() => setFailed(false), [url]);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl font-bold text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, ${color}, ${color}cc)`,
        fontSize: size * 0.36,
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
