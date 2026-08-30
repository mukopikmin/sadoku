export type Tag = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};
export type TagSummary = Tag & { documentCount: number };
export type TagReference = { id: number } | { name: string };

export type TagError =
  | { type: "invalid"; message: string }
  | { type: "not_found"; message: string }
  | { type: "conflict"; message: string };

export const prepareTagName = (value: unknown): string | TagError => {
  if (typeof value !== "string") {
    return { type: "invalid", message: "Tag name must be a string." };
  }
  const name = value.trim();
  if (!name) return { type: "invalid", message: "Tag name must not be empty." };
  if (/\p{Cc}/u.test(name)) {
    return {
      type: "invalid",
      message: "Tag name must not contain control characters.",
    };
  }
  if ([...name].length > 50) {
    return {
      type: "invalid",
      message: "Tag name must not exceed 50 characters.",
    };
  }
  return name;
};
