/** Join a public path onto Vite's base (`/drip-by-drip/` on GitHub Pages). */
export function withBase(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
