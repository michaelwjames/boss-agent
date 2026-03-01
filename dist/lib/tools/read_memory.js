/**
 * Tool to read the full content of a file from the vault, memory, or skills directory.
 */
export class ReadMemoryTool {
    fs;
    constructor(fs) {
        this.fs = fs;
    }
    async execute(args) {
        try {
            return await this.fs.readFileContent(args.filename);
        }
        catch (error) {
            return `Error: ${error.message}`;
        }
    }
}
