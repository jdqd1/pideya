import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExpenseSource1771000000000 implements MigrationInterface {
  name = "AddExpenseSource1771000000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "source" character varying(24)`)
    await queryRunner.query(`UPDATE "expenses" SET "source" = 'manual' WHERE "source" IS NULL`)
    await queryRunner.query(`ALTER TABLE "expenses" ALTER COLUMN "source" SET DEFAULT 'manual'`)
    await queryRunner.query(`ALTER TABLE "expenses" ALTER COLUMN "source" SET NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN IF EXISTS "source"`)
  }
}
