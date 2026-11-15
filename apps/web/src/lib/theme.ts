export const THEME_KEY = "pramaan-theme"
export type Theme = "dark" | "light"

// Embedded previews select a palette without replacing the workspace preference.
export const themeInitScript = `try{var p=new URLSearchParams(location.search);var t=window.self!==window.top&&p.get("embed")==="1"?p.get("theme"):localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`
