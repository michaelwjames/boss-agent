/**
 * Tool to execute a predefined make target.
 */
export class RunMakeTool {
    make;
    constructor(make) {
        this.make = make;
    }
    async execute(args) {
        const cmdResult = await this.make.run(args.target, args.args);
        return `STDOUT: ${cmdResult.stdout}\nSTDERR: ${cmdResult.stderr}\nExit Code: ${cmdResult.exitCode}`;
    }
}
