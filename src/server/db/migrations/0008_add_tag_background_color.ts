import type { Migration } from "../migrations.ts";

export const DEFAULT_TAG_BACKGROUND_COLOR = "#718096";

export const addTagBackgroundColorMigration: Migration = {
  version: "0008",
  name: "add_tag_background_color",
  checksumSource:
    "ALTER TABLE document_tag ADD COLUMN background_color TEXT NOT NULL DEFAULT '#718096' CHECK (background_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')",
  up: async (database) => {
    await database.execute(
      `ALTER TABLE document_tag ADD COLUMN background_color TEXT NOT NULL DEFAULT '${DEFAULT_TAG_BACKGROUND_COLOR}' CHECK (background_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')`,
    );
  },
};
