import type { ButtonHTMLAttributes } from "react";
import type { AvatarTone } from "../domain/social";
import { initialsFor } from "../lib/auth";
import { Droplet } from "./Icons";

const TONE: Record<AvatarTone, string> = {
  warm: "avatar-warm",
  subtle: "avatar-subtle",
  accent: "avatar-accent",
  self: "avatar-self",
  owner: "avatar-owner",
};

export function Avatar({
  name,
  tone,
  size = 32,
}: {
  name: string;
  tone: AvatarTone;
  size?: 28 | 32 | 36 | 40;
}) {
  return (
    <span className={`avatar ${TONE[tone]} avatar-${size}`} aria-hidden="true">
      {initialsFor(name, "")}
    </span>
  );
}

export function DropChip({
  sent,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { sent: boolean }) {
  return (
    <button type="button" {...props} className={sent ? "drop-chip is-sent" : "drop-chip"} disabled={sent || props.disabled}>
      <Droplet size={13} aria-hidden="true" />
      {sent ? "Sent" : "Drop"}
    </button>
  );
}
