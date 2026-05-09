import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserLevels1727133000000 implements MigrationInterface {
  name = 'AddUserLevels1727133000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_levels" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "level_id" varchar(40) NOT NULL DEFAULT 'dulce-nuevo',
        "points_in_window" float NOT NULL DEFAULT 0,
        "window_start" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "window_end" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "awarded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP WITH TIME ZONE NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "fk_user_levels_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "user_levels_user_unique" UNIQUE ("user_id")
      );
    `)

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_levels_level" ON "user_levels" ("level_id");`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_levels_window" ON "user_levels" ("window_end");`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_levels_window";`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_levels_level";`)
    await queryRunner.query(`DROP TABLE IF EXISTS "user_levels";`)
  }
}
