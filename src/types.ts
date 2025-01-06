export interface IndexConfig {
  unique?: boolean;
  sparse?: boolean;
}

export interface Transaction {
  id: string;
  operations: Array<{
    type: "insert" | "update" | "delete";
    collection: string;
    document: any;
    query?: any;
  }>;
  status: "pending" | "committed" | "rolled_back";

  snapshots: Map<string, Map<string, any>>;
}

export interface DBOptions {
  directory: string;
  autoSave?: boolean;
  saveInterval?: number;
  prettyPrint?: boolean;
}

export interface QueryOptions {
  sort?: { [key: string]: 1 | -1 };
  skip?: number;
  joins?: JoinOption[];
  limit?: number;
}

export interface Document {
  id: string;
  [key: string]: any;
}

export interface JoinOption {
  collection: string;
  localField: string;
  foreignField: string;
  as?: string;
}

export type ComparisonOperator = 
  | '$eq' 
  | '$gt' 
  | '$gte' 
  | '$lt' 
  | '$lte' 
  | '$in' 
  | '$nin' 
  | '$ne'
  | '$exists'
  | '$type'
  | '$regex';

export type LogicalOperator = 
  | '$and'
  | '$or'
  | '$not';

export type ArrayOperator =
  | '$all'
  | '$elemMatch'
  | '$size';

export type QueryOperator = ComparisonOperator | LogicalOperator | ArrayOperator;

export type QueryValue = any;

export interface OperatorQuery {
  [key: string]: {
    [K in QueryOperator]?: QueryValue;
  } | QueryValue | OperatorQuery[];
}