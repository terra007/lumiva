import type { SVGProps } from "react";

/**
 * Schlichte Linien-Symbole für Navigation und Knöpfe, ohne zusätzliches Paket.
 * 24er-Raster, Strichstärke 1,75, Farbe aus `currentColor`.
 */
const PFADE = {
  uebersicht: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  kalender: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  patienten: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.2 2.5 3.5 5.2" />
    </>
  ),
  honorarnoten: (
    <>
      <path d="M6 2.5h9l4 4V21.5H6z" />
      <path d="M14.5 2.5V7H19M9 12h7M9 16h5" />
    </>
  ),
  aufgaben: (
    <>
      <path d="m3.5 6.5 1.8 1.8L8.5 5M3.5 13.5l1.8 1.8 3.2-3.3" />
      <path d="M12 7h8.5M12 14h8.5M5 20h15.5" />
    </>
  ),
  kennzahlen: <path d="M4 20.5V13M10 20.5V4M16 20.5v-11M2.5 20.5h19" />,
  einstellungen: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  mehr: (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
  abmelden: (
    <>
      <path d="M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  links: <path d="m15 18-6-6 6-6" />,
  rechts: <path d="m9 18 6-6-6-6" />,
  schliessen: <path d="M18 6 6 18M6 6l12 12" />,
  suche: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.5-4.5" />
    </>
  ),
  haken: <path d="M20 6 9 17l-5-5" />,
  zurueck: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  hinweis: (
    <>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  uhr: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
} as const;

export type ZeichenName = keyof typeof PFADE;

export function Zeichen({
  name,
  className = "size-4",
  ...rest
}: { name: ZeichenName } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      {PFADE[name]}
    </svg>
  );
}
