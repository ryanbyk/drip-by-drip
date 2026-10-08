/** Join a public path onto Vite's base (`/` on the hosted app). */
export function withBase(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
