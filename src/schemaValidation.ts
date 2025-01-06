export interface Schema {
    [key: string]: 'string' | 'number' | 'boolean' | 'object' | 'array';
  }
  
  export function defineSchema(schema: Schema): Schema {
    return schema;
  }
  
  export function validateDocument(schema: Schema, document: any): boolean {
    for (const [key, type] of Object.entries(schema)) {
      if (typeof document[key] !== type) {
        return false;
      }
    }
    return true;
  }
  