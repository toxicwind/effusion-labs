import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

export class ServerProcess extends EventEmitter {
  constructor(entry) {
    super();
    this.entry = entry;
    this.proc = null;
    this.status = 'disabled';
  }
  async ensure() {
    if (this.proc) return;
    const { cmd, args = [], cwd } = this.entry;
    this.proc = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    this.status = 'ready';
    this.proc.stdout.on('data', (d) => this.emit('stdout', d.toString().trim()));
    this.proc.stderr.on('data', (d) => this.emit('stderr', d.toString().trim()));
    this.proc.on('exit', () => {
      this.status = 'degraded';
      this.proc = null;
    });
  }
}
