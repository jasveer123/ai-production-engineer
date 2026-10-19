/**
 * Sandbox escape tests (Phase 5 security gate). They run real containers, so Docker must be up.
 * Each case is something untrusted test code might try.
 */
import { exec, runInSandbox } from '../src/docker';

const IMAGE = 'node:22-slim';

beforeAll(async () => {
  const r = await exec('docker', ['image', 'inspect', IMAGE]);
  if (r.code !== 0) throw new Error(`Pull ${IMAGE} first (docker pull ${IMAGE})`);
});

describe('sandbox isolation', () => {
  it('has no network: outbound HTTP and DNS fail', async () => {
    const r = await runInSandbox(
      IMAGE,
      `node -e "fetch('https://example.com').then(()=>{console.log('LEAKED');process.exit(0)}).catch(e=>{console.log('blocked:',e.cause?.code||e.message);process.exit(3)})"`,
    );
    expect(r.stdout).not.toContain('LEAKED');
    expect(r.code).toBe(3);
  });

  it('runs as an unprivileged user with no capabilities', async () => {
    const r = await runInSandbox(IMAGE, 'id -u; grep CapEff /proc/self/status');
    expect(r.stdout).toContain('1000');
    expect(r.stdout).toMatch(/CapEff:\s+0000000000000000/);
  });

  it('cannot write outside tmpfs (read-only root filesystem)', async () => {
    const r = await runInSandbox(
      IMAGE,
      'echo x > /etc/hacked; echo x > /usr/hacked; echo ok > /work/fine && cat /work/fine',
    );
    const out = r.stdout + r.stderr;
    expect(out).toMatch(/Read-only file system|Permission denied/);
    expect(out).not.toMatch(/^x$/m);
    expect(r.stdout).toContain('ok'); // the sandbox can still write its own scratch space
  });

  it('cannot see the Docker socket or host files', async () => {
    const r = await runInSandbox(
      IMAGE,
      'ls -la /var/run/docker.sock 2>&1; ls /Users 2>&1; ls /host 2>&1; true',
    );
    expect(r.stdout).toMatch(/No such file/);
    expect(r.stdout).not.toMatch(/docker\.sock\s*$/m);
  });

  it('caps the number of processes (fork bomb is contained)', async () => {
    const r = await runInSandbox(
      IMAGE,
      `node -e "const {spawn}=require('child_process');let n=0,e=0;for(let i=0;i<400;i++){try{spawn('sleep',['5']).on('error',()=>e++);n++}catch{e++}}setTimeout(()=>{console.log('spawned',n,'errors',e);process.exit(0)},1500)"`,
      [],
      { pids: 64, timeoutMs: 30_000 },
    );
    const errors = Number(/errors (\d+)/.exec(r.stdout)?.[1] ?? 0);
    expect(errors).toBeGreaterThan(0);
  });

  it('kills runaway code at the timeout and leaves no container behind', async () => {
    const r = await runInSandbox(IMAGE, 'sleep 60', [], { timeoutMs: 3_000 });
    expect(r.timedOut).toBe(true);
    const ps = await exec('docker', [
      'ps',
      '-a',
      '--filter',
      `name=${r.name}`,
      '--format',
      '{{.Names}}',
    ]);
    expect(ps.stdout.trim()).toBe('');
  });

  it('enforces the memory limit', async () => {
    const r = await runInSandbox(
      IMAGE,
      `node -e "const a=[];for(;;){a.push(Buffer.alloc(50*1024*1024,1))}"`,
      [],
      { memory: '128m', timeoutMs: 30_000 },
    );
    expect(r.code).not.toBe(0);
  });
});
