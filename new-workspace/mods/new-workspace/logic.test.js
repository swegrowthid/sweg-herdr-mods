import test from "node:test";
import assert from "node:assert/strict";
import { canBack, canForward, crumbs, goBack, goForward, nameOf, normalize, parentOf, parseListing, places, recordNav, recents, remember } from "./logic.js";

const HOME = "/Users/kyomel";

test("normalize expands ~ and trims trailing slashes", () => {
  assert.equal(normalize("~", HOME), HOME);
  assert.equal(normalize("~/eay-kyomel", HOME), HOME + "/eay-kyomel");
  assert.equal(normalize(HOME + "/", HOME), HOME);
  assert.equal(normalize("/", HOME), "/");
  assert.equal(normalize("", HOME), HOME);
});

test("parentOf stops at the root", () => {
  assert.equal(parentOf("/"), null);
  assert.equal(parentOf("/Users"), "/");
  assert.equal(parentOf("/Users/kyomel/x"), "/Users/kyomel");
});

test("nameOf returns the last segment", () => {
  assert.equal(nameOf("/"), "/");
  assert.equal(nameOf("/Users/kyomel/x"), "x");
});

test("crumbs keeps ~ and the last three folders", () => {
  assert.deepEqual(crumbs(HOME, HOME), [{ name: "~", path: HOME }]);
  assert.deepEqual(crumbs(HOME + "/a/b/c/d", HOME), [
    { name: "~", path: HOME },
    { name: "b", path: HOME + "/a/b" },
    { name: "c", path: HOME + "/a/b/c" },
    { name: "d", path: HOME + "/a/b/c/d" },
  ]);
  assert.deepEqual(crumbs("/tmp/x", HOME), [
    { name: "/", path: "/" },
    { name: "tmp", path: "/tmp" },
    { name: "x", path: "/tmp/x" },
  ]);
});

test("parseListing reads the write flag and sorts names", () => {
  assert.deepEqual(parseListing("W\0b\0a\0"), { writable: true, entries: ["a", "b"] });
  assert.deepEqual(parseListing("R\0"), { writable: false, entries: [] });
  assert.deepEqual(parseListing(""), { writable: false, entries: [] });
});

test("recents dedupes and keeps local space folders", () => {
  const spaces = [
    { machine: null, folder: "/work/alpha" },
    { machine: "vps", folder: "/work/remote" },
    { machine: null, folder: "" },
  ];
  assert.deepEqual(recents(["/work/beta", "/work/alpha", "/work/beta"], spaces, HOME), [
    "/work/beta",
    "/work/alpha",
  ]);
});

test("remember puts the new folder first and caps the list", () => {
  assert.deepEqual(remember("/new", ["/old", "/new", "/older"], 2), ["/new", "/old"]);
});

test("places returns the four shortcuts", () => {
  assert.deepEqual(places(HOME).map((place) => place.name), ["Home", "Desktop", "Documents", "Downloads"]);
});

test("recordNav records the first folder and no-ops on the same path", () => {
  const empty = { list: [], hi: -1 };
  const first = recordNav(empty, HOME);
  assert.deepEqual(first, { list: [HOME], hi: 0 });
  assert.equal(recordNav(first, HOME), first);
});

test("recordNav drops the forward tail on a new jump", () => {
  let state = { list: [], hi: -1 };
  state = recordNav(state, HOME);
  state = recordNav(state, HOME + "/a");
  state = recordNav(state, HOME + "/a/b");
  state = goBack(state);
  state = recordNav(state, HOME + "/c");
  assert.deepEqual(state, { list: [HOME, HOME + "/a", HOME + "/c"], hi: 2 });
});

test("goBack and goForward move the index and refuse at the ends", () => {
  let state = { list: [], hi: -1 };
  state = recordNav(state, HOME);
  state = recordNav(state, HOME + "/a");
  assert.equal(canBack(state), true);
  assert.equal(canForward(state), false);
  const back = goBack(state);
  assert.deepEqual(back, { list: [HOME, HOME + "/a"], hi: 0 });
  assert.equal(goBack(back), null);
  assert.deepEqual(goForward(back), state);
  assert.equal(goForward(state), null);
});
