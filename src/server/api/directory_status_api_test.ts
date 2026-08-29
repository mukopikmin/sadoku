import { assertEquals } from "@std/assert";
import { createLoadingDirectorySession } from "../directory_session.ts";
import { getDirectoryStatus } from "./directory_status_api.ts";

Deno.test("directory status API returns no-store progress", async () => {
  const state = createLoadingDirectorySession(".");
  state.status = { state: "loading", detected: 4, registered: 2 };
  const response = getDirectoryStatus(state);

  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), state.status);
});
