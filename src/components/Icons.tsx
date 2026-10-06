export function Drop({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 3c0 0-9 10.2-9 16.2a9 9 0 0 0 18 0C25 13.2 16 3 16 3z"
      />
    </svg>
  );
}
