import { timingSafeEqual } from "node:crypto";

export function isCronAuthorized(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
