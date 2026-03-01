import { Tool } from './base.js';
import { MakeExecutor } from '../executors/make_executor.js';

/**
 * Tool to execute a predefined make target.
 */
export class RunMakeTool implements Tool {
  private make: MakeExecutor;

  constructor(make: MakeExecutor) {
    this.make = make;
  }

  async execute(args: any): Promise<string> {
    const cmdResult = await this.make.run(args.target, args.args);
    return `STDOUT: ${cmdResult.stdout}\nSTDERR: ${cmdResult.stderr}\nExit Code: ${cmdResult.exitCode}`;
  }
}
