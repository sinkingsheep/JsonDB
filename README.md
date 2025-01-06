# JsonDB

A powerful, MongoDB-like JSON database for Node.js with TypeScript support. JsonDB provides rich querying capabilities, transactions, indexing, and more, while maintaining data in simple JSON files.

## Features

- 💪 Strong TypeScript support
- 🔍 Rich query API (MongoDB-like operators)
- 📑 Multiple collection support
- 🔄 Transaction support with rollback
- 📇 Indexing with unique and sparse options
- 🔗 Collection joins
- ✅ Schema validation
- 💾 Automatic saving
- 🎯 Event system
- ⛓️ Chain syntax for queries

## Installation

```bash
npm install jsondb
# or
yarn add jsondb
```

## Quick Start

```typescript
import JsonDB from 'jsondb';

interface User {
  id?: string;
  name: string;
  age: number;
  email: string;
}

async function main() {
  // Initialize database
  const db = new JsonDB({ 
    directory: './data',
    autoSave: true,
    saveInterval: 1000
  });
  await db.init();

  // Insert a document
  const user = await db.insert<User>('users', {
    name: 'John Doe',
    age: 30,
    email: 'john@example.com'
  });

  // Query documents
  const users = await db.find('users', {
    age: { $gt: 25 }
  });

  // Close database
  await db.close();
}
```

## Database Operations

### Initialization

```typescript
interface DBOptions {
  directory: string;
  autoSave?: boolean;
  saveInterval?: number;
  prettyPrint?: boolean;
}

const db = new JsonDB({
  directory: './data',
  autoSave: true,
  saveInterval: 1000,
  prettyPrint: true
});
await db.init();
```

### Basic CRUD Operations

#### Insert

```typescript
// Single insert
const user = await db.insert<User>('users', {
  name: 'John',
  age: 30
});

// Bulk insert
const users = await db.insertMany<User>('users', [
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30 }
]);
```

#### Find

```typescript
// Find all matching documents
const users = await db.find('users', {
  age: { $gt: 25 }
});

// Find one document
const user = await db.findOne('users', {
  name: 'John'
});

// Chain syntax
const results = await db
  .chain('users')
  .where({ status: 'active' })
  .sort({ age: -1 })
  .limit(10)
  .find();
```

#### Update

```typescript
// Update multiple documents
const updateCount = await db.update('users', 
  { status: 'inactive' },
  { status: 'active' }
);

// Update single document
const updated = await db.updateOne('users',
  { id: 'user123' },
  { status: 'active' }
);
```

#### Delete

```typescript
const deleteCount = await db.delete('users', {
  status: 'inactive'
});
```

### Query Operators

#### Comparison Operators

```typescript
// Equal to
{ age: { $eq: 30 } }

// Greater than
{ age: { $gt: 25 } }

// Less than or equal to
{ age: { $lte: 40 } }

// In array
{ status: { $in: ['active', 'pending'] } }

// Not in array
{ status: { $nin: ['deleted', 'banned'] } }
```

#### Logical Operators

```typescript
// AND
{
  $and: [
    { status: 'active' },
    { age: { $gt: 25 } }
  ]
}

// OR
{
  $or: [
    { status: 'admin' },
    { role: 'moderator' }
  ]
}

// NOT
{
  status: { $not: { $eq: 'inactive' } }
}
```

#### Array Operators

```typescript
// Array contains all elements
{ scores: { $all: [80, 85] } }

// Array size
{ scores: { $size: 3 } }

// Element match
{ scores: { $elemMatch: { $gte: 90 } } }
```

### Indexing

```typescript
// Create unique index
await db.createIndex('users', 'email', { unique: true });

// Create sparse index
await db.createIndex('users', 'optional_field', { sparse: true });
```

### Transactions

```typescript
// Begin transaction
const transactionId = await db.beginTransaction();

try {
  await db.insert('accounts', { id: '1', balance: 100 });
  await db.update('accounts', { id: '1' }, { balance: 50 });
  await db.commitTransaction(transactionId);
} catch (error) {
  await db.rollbackTransaction(transactionId);
  throw error;
}
```

### Joins

```typescript
const results = await db.findWithJoin('orders', 
  { status: 'pending' },
  {
    joins: [{
      collection: 'users',
      localField: 'userId',
      foreignField: 'id',
      as: 'user'
    }]
  }
);
```

### Schema Validation

```typescript
const userSchema = defineSchema({
  name: 'string',
  age: 'number',
  email: 'string'
});

const isValid = validateDocument(userSchema, document);
```

### Events

```typescript
db.on('save', (collectionName) => {
  console.log(`Collection ${collectionName} was saved`);
});

db.on('update', (collectionName, document) => {
  console.log(`Document updated in ${collectionName}`);
});

db.on('delete', (collectionName, documentId) => {
  console.log(`Document ${documentId} deleted from ${collectionName}`);
});
```

## Chain Syntax

JsonDB provides a fluent chain syntax for building queries:

```typescript
const results = await db
  .chain('users')
  .where({ status: 'active' })
  .sort({ age: -1 })
  .skip(10)
  .limit(5)
  .find();

const user = await db
  .chain('users')
  .where({ age: { $gt: 30 } })
  .findOne();
```

## Performance Considerations

- Collections are loaded lazily on first access
- Each collection is stored in a separate file
- Indexes improve query performance for indexed fields
- Auto-save interval is configurable
- In-memory caching of loaded collections

## Error Handling

```typescript
try {
  await db.insert('users', { email: 'duplicate@email.com' });
} catch (error) {
  if (error.message.includes('Unique constraint violation')) {
    // Handle unique constraint violation
  }
  throw error;
}
```

## TypeScript Support

JsonDB is written in TypeScript and provides full type support:

```typescript
interface User {
  id?: string;
  name: string;
  age: number;
  email: string;
}

const user = await db.insert<User>('users', {
  name: 'John',
  age: 30,
  email: 'john@example.com'
});
```

## Best Practices

1. **Collection Management**
   - Use separate collections for different types of data
   - Consider collection joins for related data
   - Drop unused collections to free up resources

2. **Indexing**
   - Create indexes for frequently queried fields
   - Use sparse indexes for optional fields
   - Be mindful of index overhead for write operations

3. **Transactions**
   - Use transactions for operations that need to be atomic
   - Always handle transaction errors and rollbacks
   - Keep transactions as short as possible

4. **Performance**
   - Use specific queries instead of loading all documents
   - Implement pagination for large result sets
   - Configure auto-save interval based on your needs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Credits

Created and maintained by Sujith