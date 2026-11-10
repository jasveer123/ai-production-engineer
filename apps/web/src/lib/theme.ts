export const THEME_KEY = "pramaan-theme"
export type Theme = "dark" | "light"

export const themeInitScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`
