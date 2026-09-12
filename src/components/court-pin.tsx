import { COURT_PIN_PATH, COURT_PIN_VIEWBOX } from "@/lib/maps/court-pin-art";

type CourtPinProps = {
  selected?: boolean;
  className?: string;
  title?: string;
};

export function CourtPin({ selected = false, className, title }: CourtPinProps) {
  return (
    <svg
      viewBox={COURT_PIN_VIEWBOX}
      className={className}
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {selected ? <circle cx="16" cy="14.1" r="16" fill="url(#ucPinGlow)" /> : null}
      <ellipse
        cx="16"
        cy="40.5"
        rx={selected ? 5.4 : 4.2}
        ry={selected ? 1.4 : 1.1}
        fill={selected ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.2)"}
      />
      <path
        d={COURT_PIN_PATH}
        fill="url(#ucPinFill)"
        stroke="#fff"
        strokeWidth={selected ? 2.5 : 2.15}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth={selected ? 1.7 : 1.55}
        strokeLinecap="round"
        clipPath="url(#ucBallClip)"
      >
        <circle cx="16" cy="14.1" r="6.9" />
        <path d="M16 7.2V21" />
        <path d="M15.2 7.4C10.8 10.6 10.8 17.6 15.2 20.8" />
        <path d="M16.8 7.4C21.2 10.6 21.2 17.6 16.8 20.8" />
      </g>
      <defs>
        <linearGradient id="ucPinFill" x1="16" y1="2.2" x2="16" y2="40">
          <stop stopColor="#FF8A3A" />
          <stop offset="0.22" stopColor="#FF741D" />
          <stop offset="0.55" stopColor="#F24E08" />
          <stop offset="1" stopColor="#CF4101" />
        </linearGradient>
        <radialGradient id="ucPinGlow" cx="16" cy="14" r="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6A22" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="#FF6A22" stopOpacity="0.1" />
          <stop offset="1" stopColor="#FF6A22" stopOpacity="0" />
        </radialGradient>
        <clipPath id="ucBallClip">
          <circle cx="16" cy="14.1" r="7.6" />
        </clipPath>
      </defs>
    </svg>
  );
}
