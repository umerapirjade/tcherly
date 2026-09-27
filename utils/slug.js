// Lesson slug generation (public student links: /l/:slug). Kept free of config/DB dependencies so
// scripts (scripts/migrate-lesson-slugs.js) can use it too.
const { randomString } = require("./random");

const SLUG_SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const dashIt = (x = "") => {
  if (typeof x !== "string") return "";
  var arr = x
    .toLowerCase()
    .trim()
    .replace("&", "and")
    .replace(/,|@|-|\]|\[|\)|\(+/g, "")
    .split(" ");
  return arr.join("-");
};

const genName = (name = "") => name + "-" + randomString({ length: 6, characters: SLUG_SUFFIX_CHARS });

/** New random slug for a lesson name, e.g. "intro-to-physics-a8Zk2q". */
const genSlug = (name = "") => genName(dashIt(name) || "lesson");

module.exports = { dashIt, genName, genSlug };
