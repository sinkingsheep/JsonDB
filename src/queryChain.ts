import JsonDB from "./JsonDB";
import { Document, OperatorQuery } from "./types";

export class QueryChain<T extends Document = Document> {
  private db: JsonDB;
  private collectionName: string;
  private queryConditions: OperatorQuery;
  private sortConditions: { [key: string]: 1 | -1 };
  private limitValue?: number;
  private skipValue?: number;

  constructor(db: JsonDB, collectionName: string) {
    this.db = db;
    this.collectionName = collectionName;
    this.queryConditions = {};
    this.sortConditions = {};
  }

  where(query: OperatorQuery): this {
    this.queryConditions = { ...this.queryConditions, ...query };
    return this;
  }

  sort(sort: { [key: string]: 1 | -1 }): this {
    this.sortConditions = { ...this.sortConditions, ...sort };
    return this;
  }

  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  skip(skip: number): this {
    this.skipValue = skip;
    return this;
  }

  async find(): Promise<T[]> {
    return this.db.find<T>(this.collectionName, this.queryConditions, {
      sort: this.sortConditions,
      limit: this.limitValue,
      skip: this.skipValue,
    });
  }

  async findOne(): Promise<T | null> {
    const results = await this.limit(1).find();
    return results[0] || null;
  }
}