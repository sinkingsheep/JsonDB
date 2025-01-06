import JsonDB from './JsonDB';
import fs from 'fs/promises';
import path from 'path';

interface User {
  id?: string;
  name: string;
  age: number;
  status: string;
  scores?: number[];
  email?: string;
}

async function runTest() {
  const TEST_DIR = 'test_data';
  
  // Clean up test directory before starting
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, ignore error
  }

  const db = new JsonDB({ directory: TEST_DIR, autoSave: true }); // Enable autoSave
  await db.init();

  console.log('Inserting test data...');
  const insertedUsers = await db.insertMany<User>('users', [
    { name: 'Alice', age: 25, status: 'active', scores: [85, 92, 88], email: 'alice@test.com' },
    { name: 'Bob', age: 30, status: 'inactive', scores: [75, 80, 85], email: 'bob@test.com' },
    { name: 'Charlie', age: 35, status: 'active', scores: [95, 90, 92], email: 'charlie@test.com' },
    { name: 'David', age: 28, status: 'active', scores: [70, 75, 80], email: 'david@test.com' }
  ]);

  console.log('\nInserted documents:', insertedUsers.length);
  
  // Verify the file was created and contains data
  const filePath = path.join(TEST_DIR, 'users.json');
  const fileContent = await fs.readFile(filePath, 'utf8');
  const savedData = JSON.parse(fileContent);
  console.log('\nSaved document count:', Object.keys(savedData).length);

  console.log('\nTesting operators...');
  
  // Test $eq
  const eqResults = await db.find('users', { age: { $eq: 30 } });
  console.log('\n$eq test (age = 30):', 
    eqResults.map(u => `${u.name} (${u.age})`));

  // Test $gt
  const gtResults = await db.find('users', { age: { $gt: 30 } });
  console.log('\n$gt test (age > 30):', 
    gtResults.map(u => `${u.name} (${u.age})`));

  // Test $in
  const inResults = await db.find('users', { age: { $in: [25, 35] } });
  console.log('\n$in test (age in [25, 35]):', 
    inResults.map(u => `${u.name} (${u.age})`));

  // Cleanup
  await db.close();
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}

runTest().catch(console.error);