import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateLoyaltyRulesConfig1770000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loyalty_rules_config" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "rules" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "loyalty_rules_config";`)
  }
}
