import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserPassword1727131000000 implements MigrationInterface {
  name = 'AddUserPassword1727131000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "password_hash" varchar NULL;
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "users_email_idx";`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";`)
  }
}
