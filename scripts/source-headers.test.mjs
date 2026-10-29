// SPDX-License-Identifier: Apache-2.0

// Checks every source code file starts with the project's header, after any line a tool requires
// first: the licence line, a blank line, a comment describing the file, and a blank line before the
// code. Every other file must be a known kind of file that is not source code, so a new language
// cannot skip the check unnoticed. The licence itself is checked by 'pnpm lint:licences'.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

// Files that carry no header, matching the files REUSE.toml lists.
const notSourceCode = [
  /\.(md|json)$/,
  /^packages\/db\/migrations\//,
  /^LICENSES\//,
  /^(LICENSE|NOTICE|REUSE\.toml|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/,
  /^\.(editorconfig|gitattributes|gitignore|node-version|prettierignore)$/,
];

// Source code files, each with the comment markers its header uses: a line comment, or a block
// comment that opens and closes.
const sourceCode = [
  { pattern: /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, comment: "//" },
  { pattern: /\.(sh|ps1|psm1|psd1|ya?ml)$/, comment: "#" },
  { pattern: /\.env\.example$/, comment: "#" },
  { pattern: /(^|\/)(Dockerfile|Containerfile)[^/]*$/, comment: "#" },
  { pattern: /\.css$/, comment: "/*", close: "*/" },
  { pattern: /\.html$/, comment: "<!--", close: "-->" },
];
const shebangScript = { comment: "#" };

// Lines that tools require at the very top of a file, before the header.
const requiredFirstLine =
  /^(#!|#Requires |# shellcheck shell=|# ?(syntax|escape|check)=|<!doctype html>)/;

// Tool directives, which are not descriptions.
const directive =
  /^(\/\/|#) ?(eslint|prettier|shellcheck|@ts-|v8 |c8 |istanbul|syntax=|escape=|check=)/;

const projectFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: repositoryRoot, encoding: "utf8" },
)
  .split("\n")
  .filter((file) => file !== "" && existsSync(join(repositoryRoot, file)));

function isNotSourceCode(file) {
  return notSourceCode.some((pattern) => pattern.test(file));
}

function markersFor(file) {
  if (isNotSourceCode(file)) return undefined;
  return sourceCode.find(({ pattern }) => pattern.test(file));
}

// Returns the comment lines at the start of the given lines: a PowerShell help block, a block
// comment, or a run of line comments.
function descriptionLines(lines, { comment, close }) {
  if (lines[0] === "<#") return lines.slice(0, lines.indexOf("#>") + 1);
  if (close !== undefined) {
    if (!lines[0]?.startsWith(comment)) return [];
    return lines.slice(0, lines.findIndex((line) => line.endsWith(close)) + 1);
  }
  const end = lines.findIndex((line) => !line.startsWith(comment));
  return end === -1 ? lines : lines.slice(0, end);
}

function describesTheFile(description, { comment }) {
  if (description[0] === "<#") {
    const keyword = description.findIndex((line) =>
      /^\.(SYNOPSIS|DESCRIPTION)$/.test(line),
    );
    return keyword !== -1 && /\S/.test(description.at(keyword + 1) ?? "");
  }
  const first = description[0] ?? "";
  return (
    first.startsWith(`${comment} `) &&
    /\S/.test(first.charAt(comment.length + 1)) &&
    !directive.test(first)
  );
}

describe("source code file headers", () => {
  it("finds the source code files to check", () => {
    assert.ok(projectFiles.some((file) => markersFor(file) !== undefined));
  });

  it("knows whether every file is source code", () => {
    const unknown = projectFiles.filter(
      (file) =>
        markersFor(file) === undefined &&
        !isNotSourceCode(file) &&
        !readFileSync(join(repositoryRoot, file), "utf8").startsWith("#!"),
    );
    assert.deepEqual(
      unknown,
      [],
      "Add these files' type to the source code types here, or, if they are not source code, to the list of files without headers here and in REUSE.toml",
    );
  });

  for (const file of projectFiles) {
    const markers =
      markersFor(file) ??
      (readFileSync(join(repositoryRoot, file), "utf8").startsWith("#!")
        ? shebangScript
        : undefined);
    if (markers === undefined) continue;
    const { comment, close } = markers;

    it(`${file} has a licence line, a description, and a blank line after them`, () => {
      const lines = readFileSync(join(repositoryRoot, file), "utf8").split(
        "\n",
      );
      const start = lines.findIndex((line) => !requiredFirstLine.test(line));
      const [licence, blank, ...rest] = lines.slice(start);
      // The REUSE tool would otherwise read the expected text below as this file's licence.
      // REUSE-IgnoreStart
      assert.equal(
        licence,
        `${comment} SPDX-License-Identifier: Apache-2.0${close === undefined ? "" : ` ${close}`}`,
      );
      // REUSE-IgnoreEnd
      assert.equal(blank, "");
      const description = descriptionLines(rest, markers);
      assert.ok(
        describesTheFile(description, markers),
        "The licence line must be followed by a blank line and a comment describing the file",
      );
      assert.equal(
        rest.at(description.length),
        "",
        "The description must be followed by a blank line",
      );
    });
  }
});
