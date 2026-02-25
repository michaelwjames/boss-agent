import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class ShellExecutor {
  async run(command: string): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0
      };
    } catch (error: any) {
      return {
        stdout: error.stdout ? error.stdout.trim() : '',
        stderr: error.stderr ? error.stderr.trim() : error.message,
        exitCode: error.code || 1
      };
    }
  }
}
