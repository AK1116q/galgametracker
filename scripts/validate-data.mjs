import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePack } from "../core/validation.mjs";
export { validatePack } from "../core/validation.mjs";

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? filesIn(path)
      : entry.name.endsWith(".route.json")
        ? [path]
        : [];
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const files = process.argv.slice(2);
  if (!files.length)
    files.push(...filesIn(fileURLToPath(new URL("../data", import.meta.url))));
  if (!files.length) {
    console.error("No route data found");
    process.exitCode = 1;
  }
  for (const file of files) {
    try {
      const errors = validatePack(JSON.parse(readFileSync(file, "utf8")));
      if (errors.length) {
        console.error(`${file}\n${errors.join("\n")}`);
        process.exitCode = 1;
      } else console.log(`OK ${file}`);
    } catch (error) {
      console.error(`${file}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
