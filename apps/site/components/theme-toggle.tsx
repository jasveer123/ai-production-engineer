'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
export function ThemeToggle() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setTheme(document.documentElement.dataset.theme || 'dark'),
    );
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <button
      className="theme-toggle"
      aria-label={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute('content', next === 'dark' ? '#0b0b10' : '#fafafa');
        setTheme(next);
        try {
          localStorage.setItem('pramaan-site-theme', next);
        } catch {
          /* Theme remains usable when storage is unavailable. */
        }
      }}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      <span>{theme === 'dark' ? 'Day' : 'Night'}</span>
    </button>
  );
}
