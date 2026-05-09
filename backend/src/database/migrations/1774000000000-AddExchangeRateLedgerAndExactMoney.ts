import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExchangeRateLedgerAndExactMoney1774000000000 implements MigrationInterface {
    name = "AddExchangeRateLedgerAndExactMoney1774000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "exchange_rates" (
                "date" date PRIMARY KEY,
                "rate" numeric(12,4) NOT NULL,
                "source" varchar(50) NOT NULL DEFAULT 'official',
                "fetched_at" timestamp NOT NULL DEFAULT now(),
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "exchange_rate_date" date`);
        await queryRunner.query(`ALTER TABLE "sale_events" ADD COLUMN IF NOT EXISTS "exchange_rate_date" date`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "exchange_rate_date" date`);

        await this.alterNumeric(queryRunner, "tickets", "amount", 12, 2);
        await this.alterNumeric(queryRunner, "tickets", "discount", 12, 2);
        await this.alterNumeric(queryRunner, "tickets", "points", 12, 2);
        await this.alterNumeric(queryRunner, "tickets", "exchange_rate", 12, 4);

        await this.alterNumeric(queryRunner, "sale_events", "price", 12, 2);
        await this.alterNumeric(queryRunner, "sale_events", "points", 12, 2);
        await this.alterNumeric(queryRunner, "sale_events", "exchangeRate", 12, 4);

        await this.alterNumeric(queryRunner, "expenses", "amount", 12, 2);
        await this.alterNumeric(queryRunner, "expenses", "exchangeRate", 12, 4);

        await this.alterNumeric(queryRunner, "products", "price", 12, 2);
        await this.alterNumeric(queryRunner, "products", "points", 12, 2);
        await this.alterNumeric(queryRunner, "products", "cost", 12, 2);

        await queryRunner.query(`
            UPDATE "tickets"
            SET "exchange_rate_date" = COALESCE("confirmed_at", "created_at")::date
            WHERE "exchange_rate" IS NOT NULL AND "exchange_rate_date" IS NULL
        `);
        await queryRunner.query(`
            UPDATE "sale_events"
            SET "exchange_rate_date" = "occurredAt"::date
            WHERE "exchangeRate" IS NOT NULL AND "exchange_rate_date" IS NULL
        `);
        await queryRunner.query(`
            UPDATE "expenses"
            SET "exchange_rate_date" = "occurredAt"::date
            WHERE "exchangeRate" IS NOT NULL AND "exchange_rate_date" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN IF EXISTS "exchange_rate_date"`);
        await queryRunner.query(`ALTER TABLE "sale_events" DROP COLUMN IF EXISTS "exchange_rate_date"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "exchange_rate_date"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "exchange_rates"`);
    }

    private async alterNumeric(
        queryRunner: QueryRunner,
        table: string,
        column: string,
        precision: number,
        scale: number,
    ): Promise<void> {
        const hasColumn = await queryRunner.hasColumn(table, column);
        if (!hasColumn) return;
        await queryRunner.query(
            `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE numeric(${precision},${scale}) USING round("${column}"::numeric, ${scale})`,
        );
    }
}
