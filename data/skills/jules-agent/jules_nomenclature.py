import subprocess
import json
import logging
from typing import List, Dict, Optional, Any

class JulesNomenclature:
    """
    Nomenclature middleware for Python — resolves fuzzy/voice-transcribed repo names
    against a catalog of actual names from GitHub.
    """
    def __init__(self):
        self.repos = []

    def load_catalog(self) -> None:
        """Load the repo catalog from GitHub via 'gh' CLI."""
        try:
            result = subprocess.run(
                ['gh', 'repo', 'list', '--json', 'name,url', '--limit', '100'],
                capture_output=True, text=True, check=True
            )
            self.repos = json.loads(result.stdout)
        except Exception as e:
            logging.warning(f"[NOMENCLATURE] Could not load repo catalog: {e}")
            self.repos = []

    def resolve_repo_name(self, input_name: str) -> Dict[str, Any]:
        """Resolve a fuzzy repo name to exact matches or candidates."""
        if not input_name or not self.repos:
            return {"exact": None, "candidates": []}

        normalized = input_name.lower().replace(' ', '-').replace('_', '-')

        # Try exact match first (case-insensitive)
        for repo in self.repos:
            if repo['name'].lower() == normalized:
                return {"exact": repo, "candidates": []}

        # Fuzzy match — substring and Levenshtein
        scored = []
        for repo in self.repos:
            repo_name_low = repo['name'].lower()
            distance = self._levenshtein(normalized, repo_name_low)
            is_substring = normalized in repo_name_low or repo_name_low in normalized

            if distance <= 3 or is_substring:
                scored.append({
                    "repo": repo,
                    "distance": distance,
                    "is_substring": is_substring
                })

        # Sort by is_substring then distance
        scored.sort(key=lambda x: (not x['is_substring'], x['distance']))

        if len(scored) == 1:
            return {"exact": scored[0]['repo'], "candidates": []}

        return {
            "exact": None,
            "candidates": [s['repo'] for s in scored[:5]]
        }

    @staticmethod
    def _levenshtein(a: str, b: str) -> int:
        """Simple Levenshtein distance implementation."""
        if len(a) < len(b):
            return JulesNomenclature._levenshtein(b, a)
        if len(b) == 0:
            return len(a)

        previous_row = range(len(b) + 1)
        for i, c1 in enumerate(a):
            current_row = [i + 1]
            for j, c2 in enumerate(b):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        return previous_row[-1]
