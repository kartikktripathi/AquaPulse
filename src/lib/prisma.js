import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

function createPrismaClient() {
  const connectionString =
    process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.__prismaInstance) {
    global.__prismaInstance = createPrismaClient();
  }
  prisma = global.__prismaInstance;
}

export default prisma;

