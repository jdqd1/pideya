import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExpensePaymentMethod1766000000000 implements MigrationInterface {
  name = "AddExpensePaymentMethod1766000000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "payment_method" character varying(50)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN IF EXISTS "payment_method"`)
  }
}
