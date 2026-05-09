import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenPublicRlsPolicies1778000000000 implements MigrationInterface {
    name = "HardenPublicRlsPolicies1778000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
                table_name text;
                sequence_name text;
                has_anon boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon');
                has_authenticated boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
                has_service_role boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role');
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
                    'ingredients',
                    'ingredient',
                    'recipes',
                    'recipe',
                    'recipe_ingredients',
                    'recipe_ingredient',
                    'sales',
                    'migrations'
                ];
            BEGIN
                FOREACH table_name IN ARRAY tables LOOP
                    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
                        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

                        IF has_anon THEN
                            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
                        END IF;

                        IF has_authenticated THEN
                            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
                        END IF;

                        IF has_service_role THEN
                            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_all', table_name);
                            EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', 'service_role_all', table_name);
                        END IF;
                    END IF;
                END LOOP;

                IF has_anon OR has_authenticated THEN
                    FOR sequence_name IN
                        SELECT c.relname
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'public'
                          AND c.relkind = 'S'
                    LOOP
                        IF has_anon THEN
                            EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon', sequence_name);
                        END IF;
                        IF has_authenticated THEN
                            EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM authenticated', sequence_name);
                        END IF;
                    END LOOP;
                END IF;
            END
            $$;
        `);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return;
    }
}
