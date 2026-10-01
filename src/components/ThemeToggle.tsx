"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

// <html data-theme> (light|dark) and data-theme-choice (auto|light|dark) are the single source of truth.
// They are set before first paint by THEME_INIT_SCRIPT and updated here.
function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-theme-choice"] });
  return () => obs.disconnect();
}
const useTheme = () => useSyncExternalStore(subscribe, () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"), () => "light" as const);
const useChoice = () => useSyncExternalStore(subscribe, () => ((document.documentElement.dataset.themeChoice as ThemeChoice) || "auto"), () => "auto" as ThemeChoice);

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "auto") {
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
    root.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } else {
    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
    root.dataset.theme = choice;
  }
  root.dataset.themeChoice = choice;
}

/** While the choice is "auto", follow the device when it changes. */
function useAutoFollow() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => { if (document.documentElement.dataset.themeChoice === "auto") document.documentElement.dataset.theme = mq.matches ? "dark" : "light"; };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
}

/** One-tap light/dark switch for the header. The icon swaps with CSS so there is no flicker on load. */
export function ThemeIconButton() {
  const theme = useTheme();
  useAutoFollow();
  return (
    <button type="button" aria-pressed={theme === "dark"} onClick={() => apply(theme === "dark" ? "light" : "dark")}
      title="Dark mode" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy hover:bg-mist">
      <span className="sr-only">Dark mode</span>
      <svg className="theme-moon h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      <svg className="theme-sun h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2V1zm0 19h2v3h-2v-3zM1 11h3v2H1v-2zm19 0h3v2h-3v-2zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zM5.6 19.8l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1zM18.4 6.3l-1.4 1.4-2.1-2.1 1.4-1.4 2.1 2.1z" /></svg>
    </button>
  );
}

/** Auto / Light / Dark chooser for Settings. */
export function ThemeChooser() {
  const choice = useChoice();
  useAutoFollow();
  const opts: { v: ThemeChoice; label: string; hint: string }[] = [
    { v: "auto", label: "Match my device", hint: "Follows your phone or computer" },
    { v: "light", label: "Light", hint: "Always light" },
    { v: "dark", label: "Dark", hint: "Easier on the eyes at night" },
  ];
  return (
    <fieldset>
      <legend className="font-semibold text-navy">Theme</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {opts.map((o) => (
          <label key={o.v} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${choice === o.v ? "border-navy bg-mist" : "border-navy/20"}`}>
            <input type="radio" name="theme" value={o.v} checked={choice === o.v} className="mt-1 h-5 w-5 shrink-0" onChange={() => apply(o.v)} />
            <span><span className="block font-semibold text-navy">{o.label}</span><span className="block text-sm text-muted">{o.hint}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
