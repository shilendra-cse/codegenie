export const bashDescription = `Run a shell command in /workspace (bash).
- Use for installing packages, running scripts, git log/status, and anything the other tools don't cover.
- Prefer read_file, search and list_files over cat, grep and find.
- Output is stdout and stderr combined. Long output is shortened; the full output is saved to a log file you can inspect with search or read_file.
- Default timeout is 2 minutes (max 10, via timeoutMs). Don't start servers or watchers that never exit.
- Don't commit, push or change branches: git delivery is handled for you.`;
