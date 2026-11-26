/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { safeReturnTo } from "@/lib/return-to";

describe("safeReturnTo: pages users come back to", () => {
  test.each([
    "/",
    "/find-a-game",
    "/recommendations",
    "/browse",
    "/collection",
    "/messages",
    "/game-nights",
    "/game-nights/new",
    "/friends",
    "/profile",
  ])("keeps %s", (path) => {
    expect(safeReturnTo(path)).toBe(path);
  });

  test.each(["/game-nights/1", "/game-nights/42", "/games/7", "/games/2147483647"])(
    "keeps the detail page %s",
    (path) => {
      expect(safeReturnTo(path)).toBe(path);
    },
  );

  test("keeps the query string and hash of an allowed page", () => {
    expect(safeReturnTo("/browse?category=Card%20Game")).toBe("/browse?category=Card%20Game");
    expect(safeReturnTo("/game-nights/42#attendees")).toBe("/game-nights/42#attendees");
  });
});

describe("safeReturnTo: everything else goes Home", () => {
  test.each([
    // Not a page (any more), or not a sensible place to return to
    "/dashboard",
    "/login",
    "/register",
    "/admin",
    "/game-nights/",
    "/profile/",
    // Invalid nested ids
    "/game-nights/0",
    "/game-nights/007",
    "/game-nights/-1",
    "/game-nights/1.5",
    "/game-nights/abc",
    "/game-nights/1e3",
    "/game-nights/2147483648",
    "/game-nights/99999999999",
    "/games/",
    "/games/0",
    "/games/12/edit",
    "/game-nights/12/../../admin",
    "/game-nights/%31",
  ])("rejects %s", (path) => {
    expect(safeReturnTo(path)).toBe("/");
  });

  test.each([
    "https://evil.example",
    "http://evil.example/game-nights/1",
    "//evil.example",
    "//evil.example/game-nights/1",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "game-nights/1",
    "/game-nights/1\n//evil.example",
    "/games/1\t",
    "/games/1\u007f",
    "%2F%2Fevil.example",
    "",
  ])("rejects external or malformed target %j", (value) => {
    expect(safeReturnTo(value)).toBe("/");
  });

  test("rejects non-string values", () => {
    for (const value of [undefined, null, 42, ["/profile"], { pathname: "/profile" }]) {
      expect(safeReturnTo(value)).toBe("/");
    }
  });
});
