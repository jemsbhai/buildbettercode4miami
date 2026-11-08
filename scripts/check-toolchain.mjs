import { readFileSync } from "node:fs";

const { engines } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const installer = process.env.npm_config_user_agent?.split(" ")[0];
const errors = [];

if (process.versions.node !== engines.node) {
  errors.push(`Node ${engines.node} is required; found ${process.versions.node}.`);
}
if (installer !== `npm/${engines.npm}`) {
  errors.push(`npm ${engines.npm} is required; found ${installer || "no npm environment"}.`);
}
if (errors.length) {
  console.error(`${errors.join("\n")}\nReopen in the devcontainer, or install Node ${engines.node} and npm ${engines.npm}, then run npm ci. See docs/DEVELOPMENT.md.`);
  process.exit(1);
}

console.log(`Toolchain OK: Node ${engines.node}, npm ${engines.npm} (${process.platform}/${process.arch}).`);
