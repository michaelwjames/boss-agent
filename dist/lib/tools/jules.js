/**
 * Tool to interact with the Jules AI agent.
 */
export class JulesTool {
    make;
    constructor(make) {
        this.make = make;
    }
    async execute(args) {
        const targetName = `jules-${args.action}`;
        // Pass relevant arguments to the make target
        const makeArgs = {};
        if (args.sessionId)
            makeArgs.ID = args.sessionId;
        if (args.prompt)
            makeArgs.MESSAGE = args.prompt;
        if (args.repo)
            makeArgs.REPO = args.repo;
        const cmdResult = await this.make.run(targetName, makeArgs);
        return `STDOUT: ${cmdResult.stdout}\nSTDERR: ${cmdResult.stderr}\nExit Code: ${cmdResult.exitCode}`;
    }
}
