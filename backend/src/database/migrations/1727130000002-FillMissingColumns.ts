import { MigrationInterface, QueryRunner } from 'typeorm'

export class FillMissingColumns1727130000002 implements MigrationInterface {
  name = 'FillMissingColumns1727130000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "password_hash" varchar NULL;
    `)

    await queryRunner.query(`
      ALTER TABLE "coupons"
      ADD COLUMN IF NOT EXISTS "verified_by" uuid NULL;
    `)

    await queryRunner.query(`
      ALTER TABLE "coupons"
      ADD COLUMN IF NOT EXISTS "used_at" TIMESTAMP WITH TIME ZONE NULL;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_coupon_verified_by'
            AND table_name = 'coupons'
        ) THEN
          ALTER TABLE "coupons"
          ADD CONSTRAINT "fk_coupon_verified_by" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      ALTER TABLE "product_claims"
      ADD COLUMN IF NOT EXISTS "points" float NOT NULL DEFAULT 1;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_claims"
      DROP COLUMN IF EXISTS "points";
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_coupon_verified_by'
            AND table_name = 'coupons'
        ) THEN
          ALTER TABLE "coupons" DROP CONSTRAINT "fk_coupon_verified_by";
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      ALTER TABLE "coupons"
      DROP COLUMN IF EXISTS "used_at";
    `)

    await queryRunner.query(`
      ALTER TABLE "coupons"
      DROP COLUMN IF EXISTS "verified_by";
    `)

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "password_hash";
    `)
  }
}
