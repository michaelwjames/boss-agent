import { Nomenclature } from '../lib/utils/nomenclature.js';
import assert from 'assert';

function testNomenclature() {
  const nom = new Nomenclature();

  // Manually set repos instead of calling gh
  (nom as any).repos = [
    { name: 'boss-agent', url: 'https://github.com/user/boss-agent' },
    { name: 'my-website', url: 'https://github.com/user/my-website' },
    { name: 'data-pipeline', url: 'https://github.com/user/data-pipeline' },
    { name: 'utils-lib', url: 'https://github.com/user/utils-lib' },
    { name: 'utils-core', url: 'https://github.com/user/utils-core' },
  ];

  // Test: exact match
  const r1 = nom.resolveRepoName('boss-agent');
  assert(r1.exact, 'should find exact match for boss-agent');
  assert.strictEqual(r1.exact!.name, 'boss-agent');

  // Test: voice transcription with spaces instead of hyphens
  const r2 = nom.resolveRepoName('boss agent');
  assert(r2.exact, 'should resolve "boss agent" to "boss-agent"');
  assert.strictEqual(r2.exact!.name, 'boss-agent');

  // Test: close misspelling
  const r3 = nom.resolveRepoName('bos-agent');
  assert(r3.exact || r3.candidates.length > 0, 'should find candidates for "bos-agent"');

  // Test: ambiguous — multiple "utils" repos
  const r4 = nom.resolveRepoName('utils');
  assert(r4.candidates.length >= 2, 'should return multiple candidates for "utils"');

  // Test: no match at all
  const r5 = nom.resolveRepoName('zzzzzznotarepo');
  assert(!r5.exact, 'should not find exact match');
  assert.strictEqual(r5.candidates.length, 0, 'should have no candidates');

  // Test: empty input
  const r6 = nom.resolveRepoName('');
  assert(!r6.exact, 'empty input should return null');

  console.log('Nomenclature tests passed!');
}

testNomenclature();
