import { MakeExecutor } from '../lib/make_executor.js';
import assert from 'assert';

async function testMakeExecutor() {
  const make = new MakeExecutor();

  // Test: allowed target runs successfully
  const res1 = await make.run('status');
  assert.strictEqual(res1.exitCode, 0, 'status target should succeed');
  assert(res1.stdout.includes('Boss Agent is running'), 'status should output expected text');

  // Test: disallowed target is rejected
  const res2 = await make.run('not-a-real-target');
  assert.strictEqual(res2.exitCode, 1, 'unknown target should fail');
  assert(res2.stderr.includes('not allowed'), 'should report target not allowed');

  // Test: shell metacharacters in target name are rejected
  const res3 = await make.run('status; rm -rf /');
  assert.strictEqual(res3.exitCode, 1, 'injection attempt should fail');
  assert(res3.stderr.includes('forbidden characters'), 'should report forbidden characters');

  // Test: shell metacharacters in args are rejected
  const res4 = await make.run('pr-diff', { PR_NUMBER: '42; echo pwned' });
  assert.strictEqual(res4.exitCode, 1, 'injection in args should fail');
  assert(res4.stderr.includes('forbidden characters'), 'should report forbidden characters in args');

  // Test: pipe injection in target name
  const res5 = await make.run('status | cat /etc/passwd');
  assert.strictEqual(res5.exitCode, 1, 'pipe injection should fail');

  // Test: backtick injection in args
  const res6 = await make.run('pr-diff', { PR_NUMBER: '`whoami`' });
  assert.strictEqual(res6.exitCode, 1, 'backtick injection should fail');

  // Test: reload targets
  make.reload();
  assert((make as any).allowedTargets.size > 0, 'should have targets after reload');

  console.log('MakeExecutor tests passed!');
}

testMakeExecutor().catch(err => {
  console.error('MakeExecutor tests failed:', err);
  process.exit(1);
});
