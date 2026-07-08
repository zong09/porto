import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';

// CLI-only DataSource for generating/running migrations by hand:
//   npm run migration:generate -- src/migrations/Name
//   npm run migration:run
// The app itself configures TypeORM in app.module.ts (migrations run
// automatically on prod boot via migrationsRun).
const url = process.env.DATABASE_URL;

export default new DataSource(
  url
    ? {
        type: 'postgres',
        url,
        entities: ENTITIES,
        migrations: ['src/migrations/*.ts'],
        ssl:
          url.includes('localhost') || url.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5435),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgrespassword',
        database: process.env.DB_DATABASE ?? 'porto',
        entities: ENTITIES,
        migrations: ['src/migrations/*.ts'],
      },
);
