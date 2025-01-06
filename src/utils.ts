export function generateId(documentId?: string): string {
    const id = documentId || crypto.randomUUID();
    return id;
  }
