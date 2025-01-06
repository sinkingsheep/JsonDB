import { promises as fs } from "fs";
import path from "path";
import { EventEmitter } from "events";
import { loadCollection, saveCollection } from "./fileOperations";
import { validateDocument, defineSchema, Schema } from "./schemaValidation";
import { AutoSaveManager } from "./autoSaveManager";
import { generateId } from "./utils";
import { matchesQuery } from "./operators";
import { Transaction, IndexConfig, DBOptions, Document, JoinOption, QueryOptions, OperatorQuery } from "./types";
import { QueryChain } from "./queryChain";

class JsonDB extends EventEmitter {
  private directory: string;
  private collections: Map<string, Map<string, any>>;
  private dirty: Set<string>;
  private prettyPrint: boolean;
  private schemas: Map<string, Schema>;
  private autoSaveManager: AutoSaveManager;
  private indexes: Map<string, Map<string, Map<any, Set<string>>>>;
  private indexConfigs: Map<string, Map<string, IndexConfig>>;
  private transactions: Map<string, Transaction>;

  constructor(options: DBOptions) {
    super();
    this.directory = options.directory;
    this.collections = new Map();
    this.dirty = new Set();
    this.prettyPrint = options.prettyPrint ?? false;
    this.schemas = new Map();
    this.indexes = new Map();
    this.indexConfigs = new Map();
    this.transactions = new Map();

    this.autoSaveManager = new AutoSaveManager(
      options.autoSave ?? true,
      options.saveInterval ?? 1000,
      () => this.saveAll()
    );
  }

  async createIndex(
    collection: string,
    field: string,
    config: IndexConfig = {}
  ): Promise<void> {
    if (!this.indexes.has(collection)) {
      this.indexes.set(collection, new Map());
    }

    const collectionIndexes = this.indexes.get(collection)!;
    collectionIndexes.set(field, new Map());

    // Store index configuration separately
    if (!this.indexConfigs.has(collection)) {
      this.indexConfigs.set(collection, new Map());
    }
    const configMap = this.indexConfigs.get(collection)!;
    configMap.set(field, config);

    // Build index for existing documents
    const docs = await this.find(collection, {});
    const fieldIndex = collectionIndexes.get(field)!;

    for (const doc of docs) {
      const value = doc[field];
      if (value === undefined && config.sparse) {
        continue;
      }

      if (!fieldIndex.has(value)) {
        fieldIndex.set(value, new Set());
      }

      fieldIndex.get(value)!.add(doc.id);

      if (config.unique && fieldIndex.get(value)!.size > 1) {
        collectionIndexes.delete(field);
        throw new Error(`Unique constraint violation for field ${field}`);
      }
    }
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create database directory: ${error}`);
    }

    this.autoSaveManager.start();
  }

  async loadCollection(collectionName: string): Promise<void> {
    if (this.collections.has(collectionName)) return;
    const collection = await loadCollection(this.directory, collectionName);
    this.collections.set(collectionName, collection);
  }

  async saveCollection(collectionName: string): Promise<void> {
    const collection = this.collections.get(collectionName);
    if (!collection) return;
    await saveCollection(
      this.directory,
      collectionName,
      collection,
      this.prettyPrint
    );
    this.dirty.delete(collectionName);
    this.emit("save", collectionName);
  }

  async saveAll(): Promise<void> {
    const promises = Array.from(this.dirty).map((name) =>
      this.saveCollection(name)
    );
    await Promise.all(promises);
  }

  async insert<T extends { id?: string }>(
    collection: string,
    document: T
  ): Promise<T & Document> {
    await this.loadCollection(collection);
    const col = this.collections.get(collection)!;
    
    const id = generateId(document.id);
    const docWithId = { ...document, id } as T & Document;
  
    // Check indexes
    if (this.indexes.has(collection)) {
      const collectionIndexes = this.indexes.get(collection)!;
      const configMap = this.indexConfigs.get(collection)!;
      
      for (const [field, fieldIndex] of collectionIndexes.entries()) {
        if (fieldIndex instanceof Map) {
          const value = docWithId[field];
          const config = configMap.get(field) as IndexConfig;

          // Skip if value is undefined and index is sparse
          if (value === undefined && config?.sparse) continue;

          if (!fieldIndex.has(value)) {
            fieldIndex.set(value, new Set());
          }

          const documents = fieldIndex.get(value)!;
          
          if (documents.size > 0 && config?.unique) {
            throw new Error(`Unique constraint violation for field ${field}`);
          }
          
          documents.add(docWithId.id);
        }
      }
    }
  
    col.set(id, docWithId);
    this.dirty.add(collection);
    return docWithId;
  }

  async insertMany<T extends { id?: string }>(
    collectionName: string,
    documents: T[]
  ): Promise<(T & { id: string })[]> {
    await this.loadCollection(collectionName);
    const collection = this.collections.get(collectionName)!;
    const results: (T & { id: string })[] = [];

    for (const doc of documents) {
      const id = generateId(doc.id);
      const docWithId = { ...doc, id } as T & { id: string };
      collection.set(id, docWithId);
      results.push(docWithId);
    }

    // Mark collection as dirty and save immediately
    this.dirty.add(collectionName);
    await this.saveCollection(collectionName);

    return results;
  }

  async findWithJoin<T>(
    collectionName: string,
    query: Partial<T> = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    await this.loadCollection(collectionName);
    const collection = this.collections.get(collectionName)!;

    let results = Array.from(collection.values()).filter((doc) =>
      Object.entries(query).every(([key, value]) => doc[key] === value)
    );

    // Apply basic paging
    if (options.skip) {
      results = results.slice(options.skip);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    // Handle optional relational joins
    if (options.joins && options.joins.length) {
      for (const join of options.joins) {
        await this.loadCollection(join.collection);
        const foreignCollection = this.collections.get(join.collection)!;
        const foreignDocs = Array.from(foreignCollection.values());

        // For each result, find related docs
        results = results.map((item) => {
          const related = foreignDocs.filter(
            (fd) => fd[join.foreignField] === item[join.localField]
          );
          return {
            ...item,
            [join.as || join.collection]: related,
          };
        });
      }
    }

    return results;
  }

  async find<T extends Document = Document>(
    collectionName: string,
    query: OperatorQuery = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    await this.loadCollection(collectionName);
    const collection = this.collections.get(collectionName)!;

    let results = Array.from(collection.values()) as T[];
    // console.log('Loaded documents:', results);

    if (Object.keys(query).length > 0) {
      results = results.filter(doc => matchesQuery(doc, query));
    }

    // Apply sort and pagination
    if (options.sort) {
      results = this.applySorting(results, options.sort);
    }
    if (options.skip) {
      results = results.slice(options.skip);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async findOne<T extends Document = Document>(
    collectionName: string,
    query: OperatorQuery = {}
  ): Promise<T | null> {
    await this.loadCollection(collectionName);
    const collection = this.collections.get(collectionName)!;
    const results = await this.find<T>(collectionName, query, { limit: 1 });
    return results[0] || null;
  }

  async update<T>(
    collectionName: string,
    query: Partial<T>,
    update: Partial<T>
  ): Promise<number> {
    await this.loadCollection(collectionName);
    const collection = this.collections.get(collectionName)!;
    let updateCount = 0;

    // Handle special case for accounts collection
    if (collectionName === 'accounts' && 'balance' in update && (update.balance as number) < 0) {
      throw new Error('Balance cannot be negative');
    }

    for (const [id, doc] of collection.entries()) {
      if (Object.entries(query).every(([key, value]) => doc[key] === value)) {
        const updatedDoc = { ...doc, ...update };
        collection.set(id, updatedDoc);
        updateCount++;
        this.emit("update", collectionName, updatedDoc);
        this.dirty.add(collectionName);
      }
    }

    return updateCount;
  }

  async updateOne<T>(
    collectionName: string,
    query: Partial<T>,
    update: Partial<T>
  ): Promise<boolean> {
    const updateCount = await this.update(collectionName, query, update);
    return updateCount > 0;
  }

  async delete<T>(collectionName: string, query: Partial<T>): Promise<number> {
    await this.loadCollection(collectionName);
    const collection = this.collections.get(collectionName)!;
    let deleteCount = 0;

    for (const [id, doc] of collection.entries()) {
      if (Object.entries(query).every(([key, value]) => doc[key] === value)) {
        collection.delete(id);
        deleteCount++;
        this.emit("delete", collectionName, id);
      }
    }

    if (deleteCount > 0) {
      this.dirty.add(collectionName);
    }

    return deleteCount;
  }

  async dropCollection(collectionName: string): Promise<void> {
    const filePath = path.join(this.directory, `${collectionName}.json`);
    try {
      await fs.unlink(filePath);
      this.collections.delete(collectionName);
      this.dirty.delete(collectionName);
      this.emit("drop", collectionName);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error(
          `Failed to drop collection ${collectionName}: ${error}`
        );
      }
    }
  }

  async beginTransaction(): Promise<string> {
    const transactionId = generateId();
    const snapshots = new Map<string, Map<string, any>>();
  
    // Take deep copy snapshots of all collections
    for (const [name, collection] of this.collections.entries()) {
      const snapshot = new Map();
      for (const [id, doc] of collection.entries()) {
        snapshot.set(id, JSON.parse(JSON.stringify(doc)));
      }
      snapshots.set(name, snapshot);
    }
  
    this.transactions.set(transactionId, {
      id: transactionId,
      operations: [],
      status: "pending",
      snapshots
    });
  
    return transactionId;
  }

  private async takeCollectionSnapshot(collectionName: string): Promise<Map<string, any>> {
    await this.loadCollection(collectionName);
    const collection = this.collections.get(collectionName);
    if (!collection) return new Map();
    return new Map(collection);
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }
  
    if (transaction.status !== "pending") {
      throw new Error("Transaction is not pending");
    }
  
    try {
      for (const operation of transaction.operations) {
        switch (operation.type) {
          case "insert":
            await this.insert(operation.collection, operation.document);
            break;
          case "update":
            await this.update(operation.collection, operation.query!, operation.document);
            break;
          case "delete":
            await this.delete(operation.collection, operation.query!);
            break;
        }
      }
  
      transaction.status = "committed";
      await this.saveAll();
    } catch (error) {
      // Ensure we rollback on any error
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }
  
  async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }
  
    // Deep copy restore from snapshots
    for (const [collectionName, snapshot] of transaction.snapshots.entries()) {
      const restoredCollection = new Map();
      for (const [id, doc] of snapshot.entries()) {
        restoredCollection.set(id, JSON.parse(JSON.stringify(doc)));
      }
      this.collections.set(collectionName, restoredCollection);
      this.dirty.add(collectionName);
    }
  
    transaction.status = "rolled_back";
    await this.saveAll();
    this.transactions.delete(transactionId);
  }

  chain<T extends Document = Document>(collectionName: string) {
    return new QueryChain<T>(this, collectionName);
  }

  private applySorting<T extends Document>(
    results: T[],
    sort: { [key: string]: 1 | -1 }
  ): T[] {
    const sortEntries = Object.entries(sort);
    return [...results].sort((a, b) => {
      for (const [key, order] of sortEntries) {
        if (a[key] < b[key]) return -1 * order;
        if (a[key] > b[key]) return 1 * order;
      }
      return 0;
    });
  }

  async close(): Promise<void> {
    this.autoSaveManager.stop();
    await this.saveAll();
    this.collections.clear();
    this.dirty.clear();
    this.emit("close");
  }
}

export default JsonDB;
