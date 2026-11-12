import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  earlyAccess: true,
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

