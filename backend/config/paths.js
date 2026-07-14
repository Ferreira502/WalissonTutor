import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

export const backendRoot = path.resolve(currentDirectory, '..');
export const frontendDistPath = path.resolve(backendRoot, '../frontend/dist');
