import { describe, it, expect } from '@jest/globals';
import { sanitizeHistory, stripInternalFields } from '../../app/lib/history_sanitizer.js';

describe('History Sanitizer', () => {
  describe('stripInternalFields', () => {
    it('should strip _fullStdout from Jules tool output', () => {
      const original = JSON.stringify({
        stdout: 'truncated',
        _fullStdout: 'full',
        success: true
      });
      const stripped = stripInternalFields(original);
      const parsed = JSON.parse(stripped);

      expect(parsed._fullStdout).toBeUndefined();
      expect(parsed.stdout).toBe('truncated');
      expect(parsed.success).toBe(true);
    });

    it('should return original if _fullStdout is not present', () => {
      const original = JSON.stringify({ stdout: 'some output', success: true });
      const stripped = stripInternalFields(original);
      expect(stripped).toBe(original);
    });

    it('should return original if not valid JSON', () => {
      const original = 'not json';
      const stripped = stripInternalFields(original);
      expect(stripped).toBe(original);
    });
  });

  describe('sanitizeHistory', () => {
    it('should restore full stdout for Jules tool messages', () => {
      const messages = [
        { role: 'user', content: 'hello' },
        {
          role: 'tool',
          name: 'jules',
          content: JSON.stringify({
            stdout: 'truncated',
            _fullStdout: 'full content',
            success: true
          })
        }
      ];

      const sanitized = sanitizeHistory(messages);
      const julesContent = JSON.parse(sanitized[1].content);

      expect(julesContent.stdout).toBe('full content');
      expect(julesContent._fullStdout).toBeUndefined();
    });

    it('should not touch other messages', () => {
      const messages = [
        { role: 'user', content: 'hello' },
        { role: 'tool', name: 'run_make', content: JSON.stringify({ stdout: 'make output' }) }
      ];
      const sanitized = sanitizeHistory(messages);
      expect(sanitized).toEqual(messages);
    });
  });
});
