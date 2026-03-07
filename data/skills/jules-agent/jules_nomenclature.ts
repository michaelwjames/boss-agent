import { execSync } from 'child_process';
import { log, logWarn } from '../../../app/lib/utils/logger.js';

export interface Repo {
  name: string;
  url: string;
}

export interface ResolutionResult {
  exact: Repo | null;
  candidates: Repo[];
}

/**
 * Nomenclature middleware for TypeScript — resolves fuzzy/voice-transcribed repo names
 * against a catalog of actual names from GitHub.
 */
export class JulesNomenclature {
  private repos: Repo[];

  constructor() {
    this.repos = [];
  }

  /**
   * Load the repo catalog from GitHub via 'gh' CLI.
   */
  loadCatalog(): void {
    try {
      const stdout = execSync('gh repo list --json name,url --limit 100', { encoding: 'utf8' });
      this.repos = JSON.parse(stdout);
    } catch (error: any) {
      // In TS skill we don't necessarily have access to log if not imported correctly,
      // but we'll try to use the app's logger if relative path works
      console.warn('[NOMENCLATURE] Could not load repo catalog:', error.message);
      this.repos = [];
    }
  }

  /**
   * Resolve a fuzzy repo name to exact matches or candidates.
   */
  resolveRepoName(inputName: string): ResolutionResult {
    if (!inputName || this.repos.length === 0) {
      return { exact: null, candidates: [] };
    }

    const normalized = inputName.toLowerCase().replace(/ /g, '-').replace(/_/g, '-');

    // Try exact match first
    const exact = this.repos.find(r => r.name.toLowerCase() === normalized);
    if (exact) return { exact, candidates: [] };

    // Fuzzy match — substring and Levenshtein
    const scored = this.repos
      .map(repo => {
        const repoNameLow = repo.name.toLowerCase();
        return {
          repo,
          distance: this._levenshtein(normalized, repoNameLow),
          isSubstring: repoNameLow.includes(normalized) || normalized.includes(repoNameLow)
        };
      })
      .filter(s => s.distance <= 3 || s.isSubstring)
      .sort((a, b) => {
        if (a.isSubstring !== b.isSubstring) return a.isSubstring ? -1 : 1;
        return a.distance - b.distance;
      });

    if (scored.length === 1) {
      return { exact: scored[0].repo, candidates: [] };
    }

    return {
      exact: null,
      candidates: scored.slice(0, 5).map(s => s.repo)
    };
  }

  private _levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
