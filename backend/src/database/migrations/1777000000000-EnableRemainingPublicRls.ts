import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableRemainingPublicRls1777000000000 implements MigrationInterface {
    name = "EnableRemainingPublicRls1777000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
                table_name text;
                tables text[] := ARRAY[
                    'sales',
                    'migrations',
                    'ingredient',
                    'recipe',
                    'recipe_ingredient',
                    'ingredients',
                    'recipes',
                    'recipe_ingredients'
                ];
            BEGIN
                FOREACH table_name IN ARRAY tables LOOP
                    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
                        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
                    END IF;
                END LOOP;
            END
            $$;
        `);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return;
    }
}
