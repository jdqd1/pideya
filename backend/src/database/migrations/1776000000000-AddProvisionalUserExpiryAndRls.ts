import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProvisionalUserExpiryAndRls1776000000000 implements MigrationInterface {
    name = "AddProvisionalUserExpiryAndRls1776000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provisional_expires_at" TIMESTAMP NULL`);
        await queryRunner.query(`
            UPDATE "users"
            SET "provisional_expires_at" = "created_at" + INTERVAL '7 days'
            WHERE "is_provisional" = true
              AND "provisional_expires_at" IS NULL
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_users_provisional_expires_at"
            ON "users" ("provisional_expires_at")
            WHERE "is_provisional" = true
        `);

        await queryRunner.query(`
            DO $$
            DECLARE
                constraint_name text;
            BEGIN
                SELECT c.conname
                INTO constraint_name
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                JOIN pg_class r ON r.oid = c.confrelid
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
                WHERE n.nspname = 'public'
                  AND t.relname = 'tickets'
                  AND r.relname = 'users'
                  AND a.attname = 'user_id'
                  AND c.contype = 'f'
                LIMIT 1;

                IF constraint_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE public.tickets DROP CONSTRAINT %I', constraint_name);
                END IF;

                IF to_regclass('public.tickets') IS NOT NULL
                   AND EXISTS (
                       SELECT 1
                       FROM information_schema.columns
                       WHERE table_schema = 'public'
                         AND table_name = 'tickets'
                         AND column_name = 'user_id'
                   ) THEN
                    ALTER TABLE public.tickets
                    ADD CONSTRAINT "FK_tickets_user_users"
                    FOREIGN KEY ("user_id") REFERENCES public.users("id") ON DELETE SET NULL;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            DO $$
            DECLARE
                table_name text;
                tables text[] := ARRAY[
                    'users',
                    'tickets',
                    'sale_events',
                    'expenses',
                    'cash_closures',
                    'coupons',
                    'products',
                    'product_claims',
                    'user_levels',
                    'user_activity',
                    'locations',
                    'push_subscriptions',
                    'business_status',
                    'loyalty_rules_config',
                    'pickup_locations',
                    'exchange_rates',
                    'sales',
                    'migrations',
                    'ingredients',
                    'ingredient',
                    'recipes',
                    'recipe',
                    'recipe_ingredients',
                    'recipe_ingredient'
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

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_provisional_expires_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "provisional_expires_at"`);
    }
}
