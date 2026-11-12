import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

let prisma;

function createPrismaClient() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://postgres:himanshu@localhost:5432/aquapulse';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.__prismaInstance) {
    global.__prismaInstance = createPrismaClient();
  }
  prisma = global.__prismaInstance;
}

export default prisma;
