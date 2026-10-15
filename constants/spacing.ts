// constants/spacing.ts
//
// Single spacing scale for the whole app (4pt grid). Every padding, margin
// and gap comes from here; no raw numbers in styles.
//
//   Related items inside a group      xs–sm  (4–8)
//   Rows, fields, card contents        md–lg  (12–16)
//   Between sections of a screen       xl     (24)
//   Screen-level breathing room        xxl+   (32+)
export const SPACE = {
  /** 2 — hairline nudges (label ↔ sublabel) */
  xxs: 2,
  /** 4 — icon ↔ text, tight chips */
  xs: 4,
  /** 8 — siblings in a group */
  sm: 8,
  /** 12 — list rows, form fields, compact cards */
  md: 12,
  /** 16 — card padding, app screen gutter */
  lg: 16,
  /** 24 — between sections, auth screen gutter */
  xl: 24,
  /** 32 — large separations, empty states */
  xxl: 32,
  /** 48 — hero / top-of-screen air */
  xxxl: 48,
  /** 64 — rare, full-screen centering */
  huge: 64,
} as const;

export const LAYOUT = {
  /** Horizontal padding of app screens (tabs, lists, details). */
  gutter: SPACE.lg,
  /** Horizontal padding of single-focus screens (login, PIN, onboarding). */
  authGutter: SPACE.xl,
  /** Vertical space between sections of a screen. */
  sectionGap: SPACE.xl,
  /** Inner padding of cards and grouped rows. */
  cardPadding: SPACE.lg,
} as const;
