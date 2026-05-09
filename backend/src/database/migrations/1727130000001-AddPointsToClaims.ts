import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPointsToClaims1727130000001 implements MigrationInterface {
  name = 'AddPointsToClaims1727130000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }
}
