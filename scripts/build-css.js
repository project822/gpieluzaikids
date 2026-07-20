const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "frontend", "public", "css");
const files = [
  "variables.css",
  "base.css",
  "navbar.css",
  "hero.css",
  "components.css",
  "layout.css",
];

let combined = "";
files.forEach((f) => {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    combined += fs.readFileSync(p, "utf8") + "\n";
  }
});

// Basic minification
combined = combined
  .replace(/\/\*[\s\S]*?\*\//g, "") // remove comments
  .replace(/\s*([{}:;,])\s*/g, "$1") // strip spaces around brackets/semicolons
  .replace(/;}/g, "}") // remove trailing semicolons
  .replace(/\s{2,}/g, " ") // collapse whitespace
  .replace(/^\s+|\s+$/g, "") // trim
  .replace(/@import\s+url\("[^"]+"\);\s*/g, ""); // remove @imports

fs.writeFileSync(path.join(dir, "style.min.css"), combined, "utf8");
const kb = Math.round(combined.length / 1024);
console.log("style.min.css rebuilt: " + kb + "KB");
