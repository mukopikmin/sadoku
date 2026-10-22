import { assertEquals } from "@std/assert";
import { addTag } from "./add_tag.ts";
import type { TagStore } from "./ports.ts";

Deno.test("addTag normalizes names and colors and uses the default color", async () => {
  const inputs: string[][] = [];
  const store: Pick<TagStore, "create"> = {
    create: (name, backgroundColor) => {
      inputs.push([name, backgroundColor]);
      return Promise.resolve({
        id: inputs.length,
        name,
        backgroundColor,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    },
  };
  await addTag(store, " API ", "#A1B2C3");
  await addTag(store, "要確認");
  await addTag(store, "😀".repeat(50));
  assertEquals(inputs, [
    ["API", "#a1b2c3"],
    ["要確認", "#718096"],
    ["😀".repeat(50), "#718096"],
  ]);
});

Deno.test("addTag rejects invalid names and colors before writing", async () => {
  const store: Pick<TagStore, "create"> = {
    create: () => Promise.reject(new Error("Unexpected create.")),
  };
  for (
    const name of [
      undefined,
      null,
      1,
      "",
      "  ",
      "a\nb",
      "a\u0000b",
      "a".repeat(51),
    ]
  ) {
    const result = await addTag(store, name);
    assertEquals("type" in result && result.type, "invalid");
  }
  for (const color of [null, 1, "", "red", "#123", "#12345g"]) {
    assertEquals(await addTag(store, "API", color), {
      type: "invalid",
      message: "Tag background color must be a hexadecimal RGB color.",
    });
  }
});
