import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPrismaClient = path.resolve(__dirname, '../../../node_modules/.prisma/client');

try {
  const clientPkg = path.resolve(__dirname, '../node_modules/@prisma/client');
  if (fs.existsSync(clientPkg)) {
    const realClient = fs.realpathSync(clientPkg);
    const src = path.resolve(realClient, '../../.prisma/client');
    if (fs.existsSync(src)) {
      fs.mkdirSync(rootPrismaClient, { recursive: true });
      fs.cpSync(src, rootPrismaClient, { recursive: true });
      console.log('Synchronized Prisma client to root node_modules/.prisma/client');
    }
  }
} catch (err) {
  console.warn('Note: Could not sync Prisma client to root:', err?.message ?? err);
}
