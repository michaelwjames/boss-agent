import { ShellExecutor } from '../lib/shell_executor.js';
import assert from 'assert';

async function testShellExecutor() {
  const shell = new ShellExecutor();
  
  // Test success
  const res1 = await shell.run('echo "hello world"');
  assert(res1.stdout === 'hello world');
  assert(res1.exitCode === 0);
  
  // Test failure
  const res2 = await shell.run('ls non_existent_file_xyz');
  assert(res2.exitCode !== 0);
  assert(res2.stderr.length > 0);
  
  console.log('ShellExecutor tests passed!');
}

testShellExecutor().catch(err => {
  console.error('ShellExecutor tests failed:', err);
  process.exit(1);
});
