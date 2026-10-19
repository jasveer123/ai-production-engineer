import { spawn } from 'node:child_process';

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

const MAX_OUTPUT = 2 * 1024 * 1024; // keep at most 2 MB of each stream

/** Runs a command, capturing bounded output, and kills it after `timeoutMs`. */
export function exec(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; onTimeout?: () => void; input?: string } = {},
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d: Buffer) => {
      if (stdout.length < MAX_OUTPUT) stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      if (stderr.length < MAX_OUTPUT) stderr += d.toString();
    });
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          opts.onTimeout?.();
          child.kill('SIGKILL');
        }, opts.timeoutMs)
      : undefined;
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, durationMs: Date.now() - started });
    });
    if (opts.input) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

export interface SandboxLimits {
  memory: string;
  cpus: string;
  pids: number;
  timeoutMs: number;
  tmpfsWork: string;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  memory: '1g',
  cpus: '2',
  pids: 256,
  timeoutMs: 180_000,
  tmpfsWork: '1g',
};

export interface Mount {
  host: string;
  container: string;
}

/**
 * The isolation flags for every sandbox container (ADR-007). Each one is load-bearing:
 * no network, read-only root, all capabilities dropped, no privilege escalation, non-root user,
 * bounded memory/CPU/processes, writable space only in tmpfs, and read-only bind mounts.
 * Never mount the Docker socket, the host filesystem, or secrets.
 */
export function sandboxArgs(
  name: string,
  image: string,
  mounts: Mount[],
  limits: SandboxLimits,
): string[] {
  return [
    'run',
    '--rm',
    '--name',
    name,
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    `/work:rw,exec,nosuid,size=${limits.tmpfsWork},uid=1000,gid=1000,mode=0700`,
    '--tmpfs',
    '/tmp:rw,nosuid,size=256m,mode=1777',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    String(limits.pids),
    '--memory',
    limits.memory,
    '--memory-swap',
    limits.memory,
    '--cpus',
    limits.cpus,
    '--user',
    '1000:1000',
    '--env',
    'HOME=/tmp',
    '--env',
    'CI=true',
    '--workdir',
    '/work',
    ...mounts.flatMap((m) => [
      '--mount',
      `type=bind,source=${m.host},target=${m.container},readonly`,
    ]),
    image,
  ];
}

export interface ContainerResult extends ExecResult {
  name: string;
}

/** Runs `script` with `sh -c` in a fresh locked-down container and always removes it. */
export async function runInSandbox(
  image: string,
  script: string,
  mounts: Mount[] = [],
  limits: Partial<SandboxLimits> = {},
): Promise<ContainerResult> {
  const l = { ...DEFAULT_LIMITS, ...limits };
  const name = `ape-sbx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const res = await exec('docker', [...sandboxArgs(name, image, mounts, l), 'sh', '-c', script], {
      timeoutMs: l.timeoutMs,
      onTimeout: () => void exec('docker', ['kill', name]).catch(() => undefined),
    });
    return { ...res, name };
  } finally {
    // --rm covers normal exits; this covers timeouts and crashes of this process's child.
    await exec('docker', ['rm', '-f', name]).catch(() => undefined);
  }
}
