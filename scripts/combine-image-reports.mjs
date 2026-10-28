// Combines Trivy reports for several container images into one JSON list on standard output.
// Usage: node scripts/combine-image-reports.mjs <image>=<report file> ...
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// A report that is missing or not JSON is recorded as null, so the summary can show it did not complete.
function readReportOrNull(readReport, path) {
  try {
    return JSON.parse(readReport(path));
  } catch {
    return null;
  }
}

export function combineImageReports(pairs, readReport) {
  return pairs.map((pair) => {
    const separator = pair.lastIndexOf("=");
    return {
      image: pair.slice(0, separator),
      report: readReportOrNull(readReport, pair.slice(separator + 1)),
    };
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const combined = combineImageReports(process.argv.slice(2), (path) =>
    readFileSync(path, "utf8"),
  );
  process.stdout.write(`${JSON.stringify(combined, null, 2)}\n`);
}
