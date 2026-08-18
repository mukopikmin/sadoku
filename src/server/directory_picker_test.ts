import { assertEquals } from "@std/assert";
import { buildDirectoryPickerCommand } from "./directory_picker.ts";

Deno.test("builds native directory picker commands", () => {
  assertEquals(buildDirectoryPickerCommand("linux"), {
    command: "zenity",
    args: [
      "--file-selection",
      "--directory",
      "--title=Select the default folder",
    ],
  });
  assertEquals(buildDirectoryPickerCommand("darwin")?.command, "osascript");
  assertEquals(
    buildDirectoryPickerCommand("windows")?.command,
    "powershell.exe",
  );
});
