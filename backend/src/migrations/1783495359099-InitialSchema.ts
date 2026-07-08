import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1783495359099 implements MigrationInterface {
  name = 'InitialSchema1783495359099';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Baseline guard: existing deployments already have this schema from
    // the old synchronize:true setup. If the users table exists, record
    // this migration as applied without touching anything.
    const [{ exists }] = (await queryRunner.query(
      `SELECT to_regclass('public.users') IS NOT NULL AS exists`,
    )) as [{ exists: boolean }];
    if (exists) {
      return;
    }
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
            CREATE TABLE "transactions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "assetId" uuid NOT NULL,
                "side" character varying NOT NULL,
                "quantity" numeric(20, 8) NOT NULL,
                "price" numeric(20, 8) NOT NULL,
                "fee" numeric(20, 8) NOT NULL DEFAULT '0',
                "date" date NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "assets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "portfolioId" uuid NOT NULL,
                "type" character varying NOT NULL,
                "symbol" character varying NOT NULL,
                "name" character varying NOT NULL,
                "currency" character varying NOT NULL DEFAULT 'THB',
                "cgId" character varying,
                "yahooSymbol" character varying,
                "manualPrice" numeric(20, 8),
                "direction" character varying NOT NULL DEFAULT 'long',
                "sortOrder" integer NOT NULL DEFAULT '0',
                CONSTRAINT "PK_da96729a8b113377cfb6a62439c" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "portfolios" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "color" integer NOT NULL DEFAULT '0',
                "sortOrder" integer NOT NULL DEFAULT '0',
                "userId" uuid NOT NULL,
                CONSTRAINT "PK_488aa6e9b219d1d9087126871ae" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "liabilities" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "name" character varying NOT NULL,
                "amount" numeric(20, 8) NOT NULL,
                "currency" character varying NOT NULL DEFAULT 'THB',
                CONSTRAINT "PK_4ef7aa825c6104e95f787636bb8" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "net_worth_history" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "date" date NOT NULL,
                "totalAssetsThb" numeric(20, 8) NOT NULL,
                "totalLiabilitiesThb" numeric(20, 8) NOT NULL,
                "netWorthThb" numeric(20, 8) NOT NULL,
                "fxRate" numeric(20, 8),
                CONSTRAINT "UQ_dd858818d36bcd9192fa2f269a9" UNIQUE ("userId", "date"),
                CONSTRAINT "PK_63466dff24bb72d7d1e6f4e603d" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "email" character varying NOT NULL,
                "passwordHash" character varying NOT NULL,
                "isDemo" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "liability_transactions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" character varying NOT NULL,
                "liabilityId" uuid NOT NULL,
                "type" character varying NOT NULL,
                "amount" numeric(20, 8) NOT NULL,
                "date" date NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_481d536321feaea7fcc0237f45d" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "transactions"
            ADD CONSTRAINT "FK_7a6e7bd44674390f67b643408b6" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "assets"
            ADD CONSTRAINT "FK_aa4553c42ccec52a710ea60f678" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "portfolios"
            ADD CONSTRAINT "FK_e4e66691a2634fcf5525e33ecf5" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "liabilities"
            ADD CONSTRAINT "FK_a07746c7a2059be1a8ca32cc2c1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "net_worth_history"
            ADD CONSTRAINT "FK_26471d02fb43809d4e5d25b720e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "liability_transactions"
            ADD CONSTRAINT "FK_3164202df83126d86c8b15e615e" FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "liability_transactions" DROP CONSTRAINT "FK_3164202df83126d86c8b15e615e"
        `);
    await queryRunner.query(`
            ALTER TABLE "net_worth_history" DROP CONSTRAINT "FK_26471d02fb43809d4e5d25b720e"
        `);
    await queryRunner.query(`
            ALTER TABLE "liabilities" DROP CONSTRAINT "FK_a07746c7a2059be1a8ca32cc2c1"
        `);
    await queryRunner.query(`
            ALTER TABLE "portfolios" DROP CONSTRAINT "FK_e4e66691a2634fcf5525e33ecf5"
        `);
    await queryRunner.query(`
            ALTER TABLE "assets" DROP CONSTRAINT "FK_aa4553c42ccec52a710ea60f678"
        `);
    await queryRunner.query(`
            ALTER TABLE "transactions" DROP CONSTRAINT "FK_7a6e7bd44674390f67b643408b6"
        `);
    await queryRunner.query(`
            DROP TABLE "liability_transactions"
        `);
    await queryRunner.query(`
            DROP TABLE "users"
        `);
    await queryRunner.query(`
            DROP TABLE "net_worth_history"
        `);
    await queryRunner.query(`
            DROP TABLE "liabilities"
        `);
    await queryRunner.query(`
            DROP TABLE "portfolios"
        `);
    await queryRunner.query(`
            DROP TABLE "assets"
        `);
    await queryRunner.query(`
            DROP TABLE "transactions"
        `);
  }
}
