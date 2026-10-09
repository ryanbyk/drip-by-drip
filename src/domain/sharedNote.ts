import { canSendDrop, type DropDraft } from "./social";

export const SHARED_NOTE_MAX = 500;

export const SHARE_NOTE_PROMISE = "Only the people you pick will see this note.";

export type SharedNote = {
  id: string;
  authorId: string;
  authorName: string;
  day: string;
  body: string;
  groupIds: string[];
  partnerIds: string[];
};

export type NoteShare = {
  day: string;
  body: string;
  groupIds: string[];
  partnerIds: string[];
};

/** The reflection text only. Answers, Not today, and Huh? are not part of a share. */
export function buildNoteShare(input: {
  day: string;
  reflection: string | undefined;
  groupIds: readonly string[];
  partnerIds: readonly string[];
  allowedGroupIds: ReadonlySet<string>;
  allowedPartnerIds: ReadonlySet<string>;
}): NoteShare | null {
  const body = input.reflection?.trim() ?? "";
  if (!body || !/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return null;
  const groupIds = [...new Set(input.groupIds.filter((id) => id && input.allowedGroupIds.has(id)))];
  const partnerIds = [...new Set(input.partnerIds.filter((id) => id && input.allowedPartnerIds.has(id)))];
  if (groupIds.length + partnerIds.length === 0) return null;
  return {
    day: input.day,
    body: body.slice(0, SHARED_NOTE_MAX),
    groupIds,
    partnerIds,
  };
}

/** A shared note uses the same daily drop. It does not earn a second one. */
export function canDropOnNote(sent: readonly DropDraft[], next: DropDraft): boolean {
  return canSendDrop(sent, next);
}
