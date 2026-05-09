import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCouponRedeemFields1727132000000 implements MigrationInterface {
  name = 'AddCouponRedeemFields1727132000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "coupons"
      ADD COLUMN IF NOT EXISTS "used_at" TIMESTAMP WITH TIME ZONE NULL,
      ADD COLUMN IF NOT EXISTS "verified_by" uuid NULL
    `)

    await queryRunner.query(`
      ALTER TABLE "coupons"
      ADD CONSTRAINT "fk_coupon_verified_by" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "fk_coupon_verified_by"`)
    await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN IF EXISTS "used_at"`)
    await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN IF EXISTS "verified_by"`)
  }
}
