import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
const execAsync = promisify(exec);
// Shell metacharacters that must never appear in target names or argument values
const DANGEROUS_CHARS = /[;|&`$(){}[\]<>!\n\r\\]/;
export class MakeExecutor {
    makefilePath;
    allowedTargets;
    constructor(makefilePath = './Makefile') {
        this.makefilePath = makefilePath;
        this.allowedTargets = this._parseTargets();
    }
    /**
     * Parse the Makefile to extract allowed target names.
     */
    _parseTargets() {
        try {
            const content = readFileSync(this.makefilePath, 'utf-8');
            const targets = new Set();
            for (const line of content.split('\n')) {
                // Match lines like "target-name:" (with optional dependencies)
                const match = line.match(/^([a-zA-Z0-9_-]+)\s*:/);
                if (match && match[1] !== '.PHONY') {
                    targets.add(match[1]);
                }
            }
            return targets;
        }
        catch {
            console.warn('Warning: Could not read Makefile. No targets will be allowed.');
            return new Set();
        }
    }
    /**
     * Reload allowed targets from the Makefile.
     */
    reload() {
        this.allowedTargets = this._parseTargets();
    }
    /**
     * Returns a formatted string of available targets and their usage.
     * Derived from running 'make help'.
     */
    getHelp() {
        try {
            const helpOutput = execSync(`make -f ${this.makefilePath} help`, { encoding: 'utf8', timeout: 2000 });
            const lines = helpOutput.split('\n');
            const commands = lines
                .map(line => line.trim())
                .filter(line => line.startsWith('make '))
                .join('; ');
            return commands;
        }
        catch (error) {
            console.warn('Warning: Could not run "make help". Using fallback list.');
            return [...this.allowedTargets].join(', ');
        }
    }
    /**
     * Execute a make target with optional arguments.
     * @param target - The make target to run
     * @param args - Key-value arguments (e.g., { PR_NUMBER: "42" })
     * @returns {CommandResult}
     */
    async run(target, args = {}) {
        // Validate target name
        if (!target || typeof target !== 'string') {
            return { stdout: '', stderr: 'Error: Target name is required.', exitCode: 1 };
        }
        if (DANGEROUS_CHARS.test(target)) {
            return { stdout: '', stderr: 'Error: Target name contains forbidden characters.', exitCode: 1 };
        }
        if (!this.allowedTargets.has(target)) {
            const available = [...this.allowedTargets].join(', ');
            return {
                stdout: '',
                stderr: `Error: Target "${target}" is not allowed. Available targets: ${available}`,
                exitCode: 1,
            };
        }
        // Build argument string with sanitization
        let argString = '';
        if (args && typeof args === 'object') {
            for (const [key, value] of Object.entries(args)) {
                if (DANGEROUS_CHARS.test(key) || DANGEROUS_CHARS.test(String(value))) {
                    return { stdout: '', stderr: `Error: Argument "${key}" contains forbidden characters.`, exitCode: 1 };
                }
                argString += ` ${key}="${String(value)}"`;
            }
        }
        const command = `make -f ${this.makefilePath} ${target}${argString}`;
        console.log(`[MAKE] Running: ${command}`);
        try {
            const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
            return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0,
            };
        }
        catch (error) {
            return {
                stdout: error.stdout ? error.stdout.trim() : '',
                stderr: error.stderr ? error.stderr.trim() : error.message.trim(),
                exitCode: error.code || 1,
            };
        }
    }
}
