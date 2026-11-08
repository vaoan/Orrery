import { execFileSync } from "node:child_process";

execFileSync(process.execPath, ["--version"], { stdio: "inherit" });
