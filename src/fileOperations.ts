import { promises as fs } from 'fs';
import path from 'path';

export async function loadCollection(directory: string, collectionName: string): Promise<Map<string, any>> {
  const filePath = path.join(directory, `${collectionName}.json`);
  try {
    await fs.mkdir(directory, { recursive: true });
    const data = await fs.readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(data);
    return new Map(Object.entries(jsonData));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Map();
    }
    throw new Error(`Failed to load collection ${collectionName}: ${error}`);
  }
}

export async function saveCollection(
  directory: string,
  collectionName: string,
  collection: Map<string, any>,
  prettyPrint: boolean
): Promise<void> {
  const filePath = path.join(directory, `${collectionName}.json`);
  try {
    await fs.mkdir(directory, { recursive: true });
    const jsonData = JSON.stringify(Object.fromEntries(collection), null, prettyPrint ? 2 : 0);
    await fs.writeFile(filePath, jsonData, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save collection ${collectionName}: ${error}`);
  }
}
