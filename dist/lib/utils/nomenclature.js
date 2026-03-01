import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
/**
 * Nomenclature middleware — resolves fuzzy/voice-transcribed repo and file names
 * against a catalog of actual names from GitHub.
 */
export class Nomenclature {
    repos;
    constructor() {
        this.repos = [];
    }
    /**
     * Load the repo catalog from GitHub via `gh` CLI.
     * Call this on startup or periodically to refresh.
     */
    async loadCatalog() {
        try {
            const { stdout } = await execAsync('gh repo list --json name,url --limit 100');
            this.repos = JSON.parse(stdout);
            console.log(`[NOMENCLATURE] Loaded ${this.repos.length} repos.`);
        }
        catch (error) {
            console.warn('[NOMENCLATURE] Could not load repo catalog:', error.message);
            this.repos = [];
        }
    }
    /**
     * Resolve a fuzzy repo name to exact matches.
     * @param input - The user's input (possibly from voice transcription)
     * @returns {ResolutionResult}
     */
    resolveRepoName(input) {
        if (!input || this.repos.length === 0) {
            return { exact: null, candidates: [] };
        }
        const normalized = input.toLowerCase().replace(/[\s_]/g, '-');
        // Try exact match first
        const exact = this.repos.find(r => r.name.toLowerCase() === normalized);
        if (exact)
            return { exact, candidates: [] };
        // Fuzzy match — substring and Levenshtein
        const scored = this.repos
            .map(repo => ({
            repo,
            distance: levenshtein(normalized, repo.name.toLowerCase()),
            isSubstring: repo.name.toLowerCase().includes(normalized) || normalized.includes(repo.name.toLowerCase()),
        }))
            .filter(s => s.distance <= 3 || s.isSubstring)
            .sort((a, b) => {
            // Prefer substring matches, then sort by distance
            if (a.isSubstring !== b.isSubstring)
                return a.isSubstring ? -1 : 1;
            return a.distance - b.distance;
        });
        if (scored.length === 1) {
            return { exact: scored[0].repo, candidates: [] };
        }
        return {
            exact: null,
            candidates: scored.slice(0, 5).map(s => s.repo),
        };
    }
}
/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[a.length][b.length];
}
