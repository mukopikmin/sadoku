import { assertEquals } from "@std/assert";
import { getGitHubAccountResponse } from "./github_account_api.ts";

Deno.test("GitHub account API returns dynamic account information", async () => {
  const response = await getGitHubAccountResponse(() =>
    Promise.resolve({
      code: 0,
      stderr: new Uint8Array(),
      stdout: new TextEncoder().encode(
        '{"avatar_url":"https://avatars.githubusercontent.com/u/583231","login":"octocat","name":null}',
      ),
    })
  );

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), {
    account: {
      avatarUrl: "https://avatars.githubusercontent.com/u/583231",
      login: "octocat",
    },
    ok: true,
  });
});
