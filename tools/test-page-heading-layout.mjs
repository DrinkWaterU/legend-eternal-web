import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/styles/ui-refresh.css", import.meta.url), "utf8");

const describedPageHeadings = html.match(/class="[^"]*page-heading-description[^"]*"/gu) ?? [];
assert.ok(describedPageHeadings.length >= 5, "應保留多個共用說明型頁首供版面回歸檢查");
assert.match(
  css,
  /\.app-page-heading \.page-heading-description\s*\{[^}]*margin:\s*8px auto 0;[^}]*text-align:\s*center;/su,
  "共用頁首說明文字應連同最大寬度容器一起置中"
);

console.log("Page heading layout contract passed.");
