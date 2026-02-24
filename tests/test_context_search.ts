import { FileSystem } from '../lib/file_system.js';

const fs = new FileSystem();

async function testContextSearch() {
  console.log('=== Testing Context Search ===\n');

  // Test 1: Query about README
  console.log('Test 1: Query about "README architecture"');
  const result1 = await fs.readAllNotes('README architecture');
  console.log('Result length:', result1.length);
  console.log('First 200 chars:', result1.substring(0, 200) + '...\n');

  // Test 2: Query about git
  console.log('Test 2: Query about "git status"');
  const result2 = await fs.readAllNotes('git status');
  console.log('Result length:', result2.length);
  console.log('First 200 chars:', result2.substring(0, 200) + '...\n');

  // Test 3: Query about tools
  console.log('Test 3: Query about "available tools"');
  const result3 = await fs.readAllNotes('available tools');
  console.log('Result length:', result3.length);
  console.log('First 200 chars:', result3.substring(0, 200) + '...\n');

  // Test 4: No query (should return all)
  console.log('Test 4: No query (should return all)');
  const result4 = await fs.readAllNotes();
  console.log('Result length:', result4.length);
  console.log('First 200 chars:', result4.substring(0, 200) + '...\n');

  console.log('=== Tests Complete ===');
}

testContextSearch().catch(console.error);
