import { initials } from "../../lib/format";

interface Props {
  name: string;
  color: string;
  size?: number;
}

export function Avatar({ name, color, size = 44 }: Props) {
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
