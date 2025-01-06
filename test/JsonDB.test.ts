import JsonDB from '../src/JsonDB';
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

describe('JsonDB Enhanced Features', () => {
  let db: JsonDB;
  const TEST_DIR = 'test_data';

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore error
    }
    
    db = new JsonDB({ directory: TEST_DIR, autoSave: false });
    await db.init();
  });

  afterEach(async () => {
    await db.close();
    // Clean up after tests
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Query Operators', () => {
    beforeEach(async () => {
      // Set up test data
      await db.insertMany<User>('users', [
        { name: 'Alice', age: 25, status: 'active', scores: [85, 92, 88], email: 'alice@test.com' },
        { name: 'Bob', age: 30, status: 'inactive', scores: [75, 80, 85], email: 'bob@test.com' },
        { name: 'Charlie', age: 35, status: 'active', scores: [95, 90, 92], email: 'charlie@test.com' },
        { name: 'David', age: 28, status: 'active', scores: [70, 75, 80], email: 'david@test.com' }
      ]);
    });

    describe('Comparison Operators', () => {
      it('should support $eq operator', async () => {
        const results = await db.find('users', {
          age: { $eq: 30 }
        });
        expect(results).toHaveLength(1);
        // @ts-ignore
        expect(results[0].name).toBe('Bob');
      });

      it('should support $gt operator', async () => {
        const results = await db.find('users', {
          age: { $gt: 28 }
        });
        expect(results).toHaveLength(2);
        // @ts-ignore
        expect(results.map(r => r.name).sort()).toEqual(['Bob', 'Charlie']);
      });

      it('should support $gte operator', async () => {
        const results = await db.find('users', {
          age: { $gte: 30 }
        });
        expect(results).toHaveLength(2);
        // @ts-ignore
        expect(results.map(r => r.name).sort()).toEqual(['Bob', 'Charlie']);
      });

      it('should support $lt operator', async () => {
        const results = await db.find('users', {
          age: { $lt: 30 }
        });
        expect(results).toHaveLength(2);
        // @ts-ignore
        expect(results.map(r => r.name).sort()).toEqual(['Alice', 'David']);
      });

      it('should support $lte operator', async () => {
        const results = await db.find('users', {
          age: { $lte: 28 }
        });
        expect(results).toHaveLength(2);
        // @ts-ignore
        expect(results.map(r => r.name).sort()).toEqual(['Alice', 'David']);
      });

      it('should support $in operator', async () => {
        const results = await db.find('users', {
          age: { $in: [25, 35] }
        });
        expect(results).toHaveLength(2);
        // @ts-ignore
        expect(results.map(r => r.name).sort()).toEqual(['Alice', 'Charlie']);
      });

      it('should support $nin operator', async () => {
        const results = await db.find('users', {
          age: { $nin: [25, 35] }
        });
        expect(results).toHaveLength(2);
        // @ts-ignore
        expect(results.map(r => r.name).sort()).toEqual(['Bob', 'David']);
      });
    });

    describe('Logical Operators', () => {
      it('should support $and operator', async () => {
        const results = await db.find('users', {
          $and: [
            { status: 'active' },
            { age: { $lt: 30 } }
          ]
        });
        expect(results).toHaveLength(2);
        // @ts-ignore
        expect(results.map(r => r.name).sort()).toEqual(['Alice', 'David']);
      });

      it('should support $or operator', async () => {
        const results = await db.find('users', {
          $or: [
            { status: 'inactive' },
            { age: { $gt: 32 } }
          ]
        });
        expect(results).toHaveLength(2);
        // @ts-ignore
        expect(results.map(r => r.name).sort()).toEqual(['Bob', 'Charlie']);
      });

      it('should support $not operator', async () => {
        const results = await db.find('users', {
          status: { $not: { $eq: 'active' } }
        });
        expect(results).toHaveLength(1);
        // @ts-ignore
        expect(results[0].name).toBe('Bob');
      });
    });

    describe('Array Operators', () => {
      it('should support $all operator', async () => {
        const results = await db.find('users', {
          scores: { $all: [95, 90] }
        });
        expect(results).toHaveLength(1);
        // @ts-ignore
        expect(results[0].name).toBe('Charlie');
      });

      it('should support $size operator', async () => {
        const results = await db.find('users', {
          scores: { $size: 3 }
        });
        expect(results).toHaveLength(4);
      });

      it('should support $elemMatch operator', async () => {
        const results = await db.find('users', {
          scores: { 
            $elemMatch: { 
              $gte: 90 
            }
          }
        });
        expect(results).toHaveLength(2);
        // @ts-ignore
        expect(results.map(r => r.name).sort()).toEqual(['Alice', 'Charlie']);
      });
    });
  });

  describe('Index Features', () => {
    beforeEach(async () => {
      await db.createIndex('users', 'email', { unique: true });
    });

    it('should enforce unique index constraint', async () => {
      // @ts-ignore
      await db.insert('users', { name: 'Alice', email: 'alice@test.com' });
      
      await expect(
        // @ts-ignore
        db.insert('users', { name: 'Alice2', email: 'alice@test.com' })
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should allow sparse index', async () => {
      await db.createIndex('users', 'optional_field', { sparse: true });
      
      // Should not throw for documents missing the indexed field
      // @ts-ignore
      await db.insert('users', { name: 'Alice', email: 'alice@test.com' });
      // @ts-ignore
      await db.insert('users', { name: 'Bob', email: 'bob@test.com' });
      
      const results = await db.find('users', {});
      expect(results).toHaveLength(2);
    });
  });

  describe('Transaction Features', () => {
    it('should handle successful transaction', async () => {
      const transactionId = await db.beginTransaction();

      try {
        await db.insert('accounts', { id: '1', balance: 100 });
        await db.insert('accounts', { id: '2', balance: 100 });
        // @ts-ignore
        await db.update('accounts', { id: '1' }, { balance: 50 });
        // @ts-ignore
        await db.update('accounts', { id: '2' }, { balance: 150 });
        
        await db.commitTransaction(transactionId);
        
        // @ts-ignore
        const account1 = await db.findOne('accounts', { id: '1' });
        // @ts-ignore
        const account2 = await db.findOne('accounts', { id: '2' });
        
        expect(account1?.balance).toBe(50);
        expect(account2?.balance).toBe(150);
      } catch (error) {
        await db.rollbackTransaction(transactionId);
        throw error;
      }
    });

    it('should rollback failed transaction', async () => {
      const transactionId = await db.beginTransaction();

      try {
        await db.insert('accounts', { id: '1', balance: 100 });
        // @ts-ignore
        await db.update('accounts', { id: '1' }, { balance: -50 }); // Assume this fails
        await db.commitTransaction(transactionId);
      } catch (error) {
        await db.rollbackTransaction(transactionId);
      }
      // @ts-ignore
      const account = await db.findOne('accounts', { id: '1' });
      expect(account?.balance).toBe (100); // Should be rolled back to original state
    });
  });

  describe('Chain Syntax', () => {
    beforeEach(async () => {
      await db.insertMany<User>('users', [
        { name: 'Alice', age: 25, status: 'active' },
        { name: 'Bob', age: 30, status: 'inactive' },
        { name: 'Charlie', age: 35, status: 'active' },
        { name: 'David', age: 28, status: 'active' }
      ]);
    });

    it('should support chain syntax for queries', async () => {
      const results = await db
        .chain('users')
        .where({ status: 'active' })
        .sort({ age: -1 })
        .limit(2)
        .find();

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Charlie');
      expect(results[1].name).toBe('David');
    });

    it('should support findOne with chain syntax', async () => {
      const result = await db
        .chain('users')
        .where({ age: { $gt: 30 } })
        .findOne();

      expect(result?.name).toBe('Charlie');
    });

    it('should support skip with chain syntax', async () => {
      const results = await db
        .chain('users')
        .sort({ age: 1 })
        .skip(1)
        .limit(2)
        .find();

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('David');
      expect(results[1].name).toBe('Bob');
    });
  });
});