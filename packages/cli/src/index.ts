import { parseArgs } from "node:util";
import { loadConfig } from "./config/loadConfig.js";
import { executeDiffCommand } from "./commands/diff.js";
import type { DiffCommandOptions } from "./types.js";

const HELP = [
  "cy-select - Select Cypress specs from Git changes",
  "",
  "Usage: cy-select [diff] [options]",
  "Commands:",
  "  diff                     Select specs (default)",
  "  help                     Show this help",
  "Options:",
  "  -b, --base <ref>          Compare with this ref's merge base",
  "  --root <directory>       Config directory (default: current directory)",
  "  -j, --json               Machine-readable JSON on stdout",
  "  -v, --verbose            Include selection reasons",
  "  -p, --pattern <glob>      Override spec patterns (repeatable)",
  "  --log-level <level>      silent, normal, verbose, debug (stderr)",
  "  -h, --help               Show this help",
  "",
  "Config: cypress-test-selector.config.{mjs,cjs,js,json}",
  "Priority: CLI > config file > package.json cypress-test-selector > defaults.",
  "Use --base explicitly in CI and fetch sufficient history for the merge base.",
  "Exit codes: 0 successful selection/no changes, 1 error, 2 changes but no specs.",
].join("\n");

/** Returns an exit code; only the executable controls process.exitCode. */
export async function main(args = process.argv.slice(2)): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args, allowPositionals: true, strict: true,
      options: {
        base: { type: "string", short: "b" },
        root: { type: "string" },
        json: { type: "boolean", short: "j" },
        verbose: { type: "boolean", short: "v" },
        pattern: { type: "string", multiple: true, short: "p" },
        "log-level": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    const command = positionals[0] ?? "diff";
    if (positionals.length > 1) throw new Error("Unexpected positional arguments");
    if (values.help || command === "help") { console.log(HELP); return 0; }
    if (command !== "diff") throw new Error("Unknown command: " + command);
    const level = values["log-level"] ?? "normal";
    if (!["silent", "normal", "verbose", "debug"].includes(level)) throw new Error("Invalid log level: " + level);
    if (values.base !== undefined && !values.base.trim()) throw new Error("--base cannot be empty");
    const config = await loadConfig(values.root ?? process.cwd());
    return await executeDiffCommand(config, {
      base: values.base, format: values.json ? "json" : "human",
      verbose: values.verbose, patterns: values.pattern,
      logLevel: level as DiffCommandOptions["logLevel"],
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
