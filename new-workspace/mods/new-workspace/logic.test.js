import test from "node:test";
import assert from "node:assert/strict";
import { crumbs, nameOf, normalize, parentOf, parseListing, places, recents, remember } from "./logic.js";

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
