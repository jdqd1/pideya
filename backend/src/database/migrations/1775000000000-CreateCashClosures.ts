import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCashClosures1775000000000 implements MigrationInterface {
    name = "CreateCashClosures1775000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "cash_closures" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "business_date" date NOT NULL,
                "exchange_rate" numeric(12,4),
                "expected_usd" numeric(12,2) NOT NULL DEFAULT 0,
                "expected_ves" numeric(14,2) NOT NULL DEFAULT 0,
                "counted_usd" numeric(12,2) NOT NULL DEFAULT 0,
                "counted_ves" numeric(14,2) NOT NULL DEFAULT 0,
                "diff_usd" numeric(12,2) NOT NULL DEFAULT 0,
                "diff_ves" numeric(14,2) NOT NULL DEFAULT 0,
                "difference_count" int NOT NULL DEFAULT 0,
                "lines" text,
                "note" text,
                "closed_by" uuid,
                "created_at" timestamp NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'FK_cash_closures_closed_by_users'
                ) THEN
                    ALTER TABLE "cash_closures"
                    ADD CONSTRAINT "FK_cash_closures_closed_by_users"
                    FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cash_closures_business_date" ON "cash_closures" ("business_date")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cash_closures_created_at" ON "cash_closures" ("created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_closures_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_closures_business_date"`);
        await queryRunner.query(`ALTER TABLE "cash_closures" DROP CONSTRAINT IF EXISTS "FK_cash_closures_closed_by_users"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "cash_closures"`);
    }
}
