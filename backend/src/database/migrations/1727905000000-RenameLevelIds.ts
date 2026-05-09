import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameLevelIds1727905000000 implements MigrationInterface {
  name = 'RenameLevelIds1727905000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user_levels"
      SET "level_id" = CASE
        WHEN "level_id" = 'dulce-nuevo' THEN 'nivel-0'
        WHEN "level_id" = 'fan-brownie' THEN 'nivel-1'
        WHEN "level_id" = 'cliente-leyenda' THEN 'nivel-2'
        WHEN "level_id" = 'maestro-brownie' THEN 'nivel-3'
        WHEN "level_id" = 'leyenda-suprema' THEN 'nivel-4'
        ELSE "level_id"
      END;
    `)

    await queryRunner.query(`
      ALTER TABLE "user_levels"
      ALTER COLUMN "level_id" SET DEFAULT 'nivel-0';
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user_levels"
      SET "level_id" = CASE
        WHEN "level_id" = 'nivel-0' THEN 'dulce-nuevo'
        WHEN "level_id" = 'nivel-1' THEN 'fan-brownie'
        WHEN "level_id" = 'nivel-2' THEN 'cliente-leyenda'
        WHEN "level_id" = 'nivel-3' THEN 'maestro-brownie'
        WHEN "level_id" = 'nivel-4' THEN 'leyenda-suprema'
        ELSE "level_id"
      END;
    `)

    await queryRunner.query(`
      ALTER TABLE "user_levels"
      ALTER COLUMN "level_id" SET DEFAULT 'dulce-nuevo';
    `)
  }
}
