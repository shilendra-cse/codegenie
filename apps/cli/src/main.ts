import { runCommand } from "./commands/run.js";
import { setupCommand } from "./commands/setup.js";
import { err } from "./commands/output.js";

// pnpm runs the script inside apps/cli; INIT_CWD is where the user ran it.
const cwd = process.env.INIT_CWD ?? process.cwd();
const [first, ...rest] = process.argv.slice(2);

const command =
  first === "setup"
    ? setupCommand(rest, cwd)
    : runCommand(first === "run" ? rest : process.argv.slice(2), cwd);

command.then(
  (code) => process.exit(code),
  (error: unknown) => {
    err(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    process.exit(1);
  },
);
