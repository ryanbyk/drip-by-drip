export function commitmentText(ref?: string): string {
  if (ref) return `I said yes—I’m reading ${ref} today.`;
  return "I said yes—I’m reading God’s word today.";
}

export async function shareCommitment(ref?: string): Promise<"shared" | "copied" | "dismissed" | "failed"> {
  const text = commitmentText(ref);
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Drip by drip", text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "dismissed";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
