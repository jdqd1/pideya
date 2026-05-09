import { MigrationInterface, QueryRunner } from 'typeorm'

export class Init1727130000000 implements MigrationInterface {
  name = 'Init1727130000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "email" varchar NOT NULL UNIQUE,
        "role" varchar(20) NOT NULL DEFAULT 'client',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_claims" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "code" varchar NOT NULL UNIQUE,
        "status" varchar(20) NOT NULL DEFAULT 'available',
        "claimed_by" uuid NULL,
        "claimed_at" TIMESTAMP WITH TIME ZONE NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "fk_product_claim_user" FOREIGN KEY ("claimed_by") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupons" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "title" varchar NOT NULL,
        "kind" varchar(12) NOT NULL,
        "threshold" integer NULL,
        "value" integer NULL,
        "cap_usd" numeric(8,2) NULL,
        "status" varchar(16) NOT NULL DEFAULT 'available',
        "expires_at" TIMESTAMP WITH TIME ZONE NULL,
        "user_id" uuid NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "fk_coupon_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "coupons";`)
    await queryRunner.query(`DROP TABLE IF EXISTS "product_claims";`)
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`)
  }
}
