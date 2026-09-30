import assert from "node:assert/strict";
import { test } from "node:test";
import { isCronAuthorized } from "@/lib/cron-auth";

const SECRET = "a-test-secret-with-at-least-32-characters";
test("pipeline endpoints fail closed without a configured secret or a matching bearer token", () => {
  const request = (value?: string) =>
    new Request("https://example.com/api/cron/pipeline", {
      headers: value ? { authorization: value } : {},
    });
  assert.equal(isCronAuthorized(request(`Bearer ${SECRET}`), SECRET), true);
  assert.equal(isCronAuthorized(request(), SECRET), false);
  assert.equal(isCronAuthorized(request(`Bearer ${SECRET}`), undefined), false);
  assert.equal(isCronAuthorized(request("Bearer short"), "short"), false);
  assert.equal(
    isCronAuthorized(request(`Bearer ${SECRET}wrong`), SECRET),
    false,
  );
});
