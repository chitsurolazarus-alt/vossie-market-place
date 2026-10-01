// Theme choice. No cookie = follow the device ("auto"). Shared by the layout (server) and the toggle (client).
export const THEME_COOKIE = "vossie_theme";
export type ThemeChoice = "auto" | "light" | "dark";

/**
 * Runs before first paint (inlined in <head>): resolves the choice to light or dark and sets <html data-theme>.
 * Kept tiny and dependency-free so there is no flash of the wrong theme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var t=m?m[1]:(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var d=document.documentElement;d.dataset.theme=t;d.dataset.themeChoice=m?m[1]:'auto';}catch(e){}})();`;
