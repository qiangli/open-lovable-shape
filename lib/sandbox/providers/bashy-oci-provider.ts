import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { SandboxProvider, SandboxInfo, CommandResult } from '../types';

const execFileAsync = promisify(execFile);
const WORKDIR = '/workspace';

/** Local Linux sandbox backed by the owner's bashy OCI engine (Podman). */
export class BashyOciProvider extends SandboxProvider {
  private containerName: string | null = null;
  private alive = false;

  private get bashyBin(): string {
    return this.config.bashyOci?.bashyBin || process.env.BASHY_BIN || 'bashy';
  }

  private async oci(args: string[], input?: string): Promise<CommandResult> {
    if (input === undefined) {
      try {
        const result = await execFileAsync(this.bashyBin, ['oci', ...args], {
          maxBuffer: 16 * 1024 * 1024,
        });
        return { stdout: result.stdout, stderr: result.stderr, exitCode: 0, success: true };
      } catch (error: any) {
        return {
          stdout: error.stdout || '',
          stderr: error.stderr || error.message || 'bashy oci failed',
          exitCode: error.code || 1,
          success: false,
        };
      }
    }

    return await new Promise((resolve) => {
      const child = spawn(this.bashyBin, ['oci', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', (error) => resolve({ stdout, stderr: error.message, exitCode: 1, success: false }));
      child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1, success: code === 0 }));
      child.stdin.end(input);
    });
  }

  private requireContainer(): string {
    if (!this.containerName || !this.alive) throw new Error('No active local sandbox');
    return this.containerName;
  }

  async createSandbox(): Promise<SandboxInfo> {
    await this.terminate();
    this.containerName = `open-lovable-${randomUUID().slice(0, 12)}`;
    const image = this.config.bashyOci?.image || process.env.SANDBOX_IMAGE || 'docker.io/library/node:22-alpine';
    const created = await this.oci([
      'run', '--detach', '--name', this.containerName,
      '--publish', '127.0.0.1::5173',
      '--workdir', WORKDIR,
      image, 'sh', '-lc', 'trap : TERM INT; sleep infinity & wait',
    ]);
    if (!created.success) throw new Error(`Could not start local sandbox: ${created.stderr}`);
    this.alive = true;

    const port = await this.oci(['port', this.containerName, '5173/tcp']);
    if (!port.success) {
      await this.terminate();
      throw new Error(`Could not resolve sandbox port: ${port.stderr}`);
    }
    const address = port.stdout.trim().split('\n')[0].replace(/^0\.0\.0\.0:/, '127.0.0.1:');
    this.sandboxInfo = {
      sandboxId: this.containerName,
      url: `http://${address}`,
      provider: 'bashy-oci',
      createdAt: new Date(),
    };
    return this.sandboxInfo;
  }

  async runCommand(command: string): Promise<CommandResult> {
    return this.oci(['exec', '--workdir', WORKDIR, this.requireContainer(), 'sh', '-lc', command]);
  }

  async writeFile(path: string, content: string): Promise<void> {
    const relative = path.replace(/^\/+/, '').replace(/^workspace\//, '');
    if (relative.split('/').includes('..')) throw new Error('File path escapes the sandbox workspace');
    const fullPath = `${WORKDIR}/${relative}`;
    const parent = fullPath.slice(0, fullPath.lastIndexOf('/'));
    const result = await this.oci([
      'exec', '--interactive', this.requireContainer(), 'sh', '-lc',
      `mkdir -p "$1" && cat > "$2"`, 'open-lovable-write', parent, fullPath,
    ], content);
    if (!result.success) throw new Error(`Could not write ${relative}: ${result.stderr}`);
  }

  async readFile(path: string): Promise<string> {
    const result = await this.oci(['exec', this.requireContainer(), 'cat', `${WORKDIR}/${path.replace(/^\/+/, '')}`]);
    if (!result.success) throw new Error(result.stderr);
    return result.stdout;
  }

  async listFiles(directory: string = WORKDIR): Promise<string[]> {
    const result = await this.oci([
      'exec', this.requireContainer(), 'find', directory, '-type', 'f',
      '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*',
    ]);
    if (!result.success) return [];
    return result.stdout.split('\n').filter(Boolean).map((path) => path.replace(`${WORKDIR}/`, ''));
  }

  async installPackages(packages: string[]): Promise<CommandResult> {
    const safe = packages.filter((name) => /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name));
    if (safe.length !== packages.length) throw new Error('Invalid package name');
    return this.runCommand(`npm install ${safe.join(' ')}`);
  }

  getSandboxUrl(): string | null { return this.sandboxInfo?.url || null; }
  getSandboxInfo(): SandboxInfo | null { return this.sandboxInfo; }

  async setupViteApp(): Promise<void> {
    const files: Record<string, string> = {
      'package.json': JSON.stringify({
        scripts: { dev: 'vite --host 0.0.0.0' },
        dependencies: { '@vitejs/plugin-react': 'latest', vite: 'latest', react: 'latest', 'react-dom': 'latest' },
        devDependencies: {},
      }, null, 2),
      'index.html': '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
      'src/main.jsx': "import React from 'react';import{createRoot}from'react-dom/client';import'./style.css';function App(){return <main><h1>Your new site</h1><p>Describe a change in chat to begin.</p></main>}createRoot(document.getElementById('root')).render(<App/>);",
      'src/style.css': 'body{font-family:system-ui;margin:0;background:#fafafa;color:#18181b}main{max-width:52rem;margin:12vh auto;padding:2rem}',
    };
    for (const [path, content] of Object.entries(files)) await this.writeFile(path, content);
    const installed = await this.runCommand('npm install --no-audit --no-fund');
    if (!installed.success) throw new Error(`Could not install sandbox packages: ${installed.stderr}`);
    const started = await this.runCommand('nohup npm run dev > /tmp/vite.log 2>&1 &');
    if (!started.success) throw new Error(`Could not start Vite: ${started.stderr}`);
  }

  async restartViteServer(): Promise<void> {
    await this.runCommand("pkill -f 'vite' || true; nohup npm run dev > /tmp/vite.log 2>&1 &");
  }

  async terminate(): Promise<void> {
    if (this.containerName) await this.oci(['rm', '--force', this.containerName]);
    this.containerName = null;
    this.sandboxInfo = null;
    this.alive = false;
  }

  isAlive(): boolean { return this.alive; }
}
