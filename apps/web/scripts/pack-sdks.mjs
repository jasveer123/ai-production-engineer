import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, renameSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repo = resolve(root, "../..")
const out = join(root, "public", "downloads")
const NODE_FILE = "ape-agent.tgz"
const PYTHON_FILE = "ape_agent-0.1.0-py3-none-any.whl"

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, stdio: ["ignore", "pipe", "inherit"] })
    .toString()
    .trim()

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

run("pnpm", ["--filter", "@ape/agent", "build"], repo)
const packed = run(
  "npm",
  ["pack", join(repo, "packages/sdk-node"), "--pack-destination", out],
  repo
)
renameSync(join(out, packed.split("\n").pop()), join(out, NODE_FILE))

run("uv", ["build", "--wheel", "--out-dir", out, join(repo, "packages/sdk-python")], repo)

const version = JSON.parse(
  readFileSync(join(repo, "packages/sdk-node/package.json"), "utf8")
).version
if (!PYTHON_FILE.includes(`-${version}-`)) {
  throw new Error(`Wheel name ${PYTHON_FILE} does not match package version ${version}`)
}
console.log(`SDK files ready in ${out}`)
