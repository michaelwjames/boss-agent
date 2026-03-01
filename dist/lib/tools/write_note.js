/**
 * Tool to save a note as a Markdown file.
 */
export class WriteNoteTool {
    fs;
    constructor(fs) {
        this.fs = fs;
    }
    async execute(args) {
        return await this.fs.writeNote(args.filename, args.content);
    }
}
