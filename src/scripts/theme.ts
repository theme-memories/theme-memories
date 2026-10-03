import { THEMES, type ThemeMode } from "../consts";

/*
 * The interactive half of the theme system. The pre-paint script in
 * `BaseHead.astro` owns the first resolution, because it has to run before the
 * browser paints; this module owns everything after that — the sun/moon toggle
 * and the palette switch.
 *
 * Mode and palette are stored separately so choosing a palette does not force a
 * light/dark choice and vice versa: `theme` is `light`/`dark`, `palette` is a
 * `THEMES` id. The two are resolved into one daisyUI theme name, which is what
 * `data-theme` carries and what `ec.config.mjs` selects the code theme on.
 */

const MODE_KEY = "theme";
const PALETTE_KEY = "palette";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable; the theme still applies for this page */
  }
}

function currentMode(): ThemeMode {
  const stored = read(MODE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function currentPaletteId(): string {
  const stored = read(PALETTE_KEY);
  return THEMES.some((theme) => theme.id === stored)
    ? (stored as string)
    : THEMES[0].id;
}

function entryFor(paletteId: string) {
  return THEMES.find((theme) => theme.id === paletteId) ?? THEMES[0];
}

export function applyTheme() {
  document.documentElement.dataset.theme =
    entryFor(currentPaletteId())[currentMode()];
}

export function enhanceThemeControls() {
  const modeToggle = document.querySelector<HTMLInputElement>(
    "[data-theme-toggle]",
  );
  const paletteInputs = document.querySelectorAll<HTMLInputElement>(
    "input[data-palette]",
  );

  const syncPalette = (paletteId: string) => {
    paletteInputs.forEach((input) => {
      input.checked = input.value === paletteId;
    });
  };

  if (modeToggle) {
    modeToggle.checked = currentMode() === "dark";
    modeToggle.addEventListener("change", () => {
      write(MODE_KEY, modeToggle.checked ? "dark" : "light");
      applyTheme();
    });
  }

  paletteInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      write(PALETTE_KEY, input.value);
      // The switch is rendered in more than one place, so every copy is
      // re-synced from the value that was just chosen.
      syncPalette(input.value);
      applyTheme();
    });
  });

  syncPalette(currentPaletteId());
  applyTheme();
}
