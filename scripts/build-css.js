const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const cssDir = path.join(__dirname, "..", "frontend", "public", "css");
const jsDir = path.join(__dirname, "..", "frontend", "public", "js");

// ── 1. Concatenate all CSS files ──
const cssFiles = [
  "variables.css",
  "base.css",
  "navbar.css",
  "hero.css",
  "components.css",
  "layout.css",
];

let combined = "";
cssFiles.forEach((f) => {
  const p = path.join(cssDir, f);
  if (fs.existsSync(p)) {
    combined += fs.readFileSync(p, "utf8") + "\n";
  }
});

// Remove @imports (they're already loaded separately in header.ejs)
combined = combined.replace(/@import\s+url\("[^"]+"\);\s*/g, "");

// Write temp file for csso
const tmpCss = path.join(cssDir, "__temp.css");
fs.writeFileSync(tmpCss, combined, "utf8");

try {
  // Use csso-cli for proper minification (structural optimizations)
  const outPath = path.join(cssDir, "style.min.css");
  execSync(`npx csso ${tmpCss} --output ${outPath}`, { stdio: "pipe" });
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log("✓ style.min.css rebuilt: " + kb + "KB (csso)");
} catch (err) {
  // Fallback: basic minification
  console.warn("⚠ csso failed, using basic fallback:", err.message);
  combined = combined
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+|\s+$/g, "");
  fs.writeFileSync(path.join(cssDir, "style.min.css"), combined, "utf8");
  const kb = Math.round(combined.length / 1024);
  console.log("style.min.css rebuilt: " + kb + "KB (fallback)");
} finally {
  // Cleanup temp file
  try { fs.unlinkSync(tmpCss); } catch (_) {}
}

// ── 2. Minify main.js with uglify-js ──
const mainJs = path.join(jsDir, "main.js");
const mainMinJs = path.join(jsDir, "main.min.js");

if (fs.existsSync(mainJs)) {
  try {
    execSync(`npx uglifyjs ${mainJs} --compress --mangle --output ${mainMinJs}`, { stdio: "pipe" });
    const kb = Math.round(fs.statSync(mainMinJs).size / 1024);
    console.log("✓ main.min.js rebuilt: " + kb + "KB (uglify)");
  } catch (err) {
    console.warn("⚠ uglify-js failed:", err.message);
  }
}

console.log("\nBuild selesai!");
