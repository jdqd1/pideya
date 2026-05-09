import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenProductsCatalog1779000000000 implements MigrationInterface {
    name = "HardenProductsCatalog1779000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "products" (
                "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                "name" varchar(180) NOT NULL,
                "price" numeric(12,2) NOT NULL DEFAULT 0,
                "points" numeric(12,2) NOT NULL DEFAULT 0,
                "stock" integer NOT NULL DEFAULT 0,
                "active" boolean NOT NULL DEFAULT true,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now(),
                "imageUrl" text NULL,
                "description" text NULL,
                "cost" numeric(12,2) NOT NULL DEFAULT 0
            );
        `);

        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "name" varchar(180) NOT NULL DEFAULT 'Producto'`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price" numeric(12,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "points" numeric(12,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imageUrl" text NULL`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" text NULL`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cost" numeric(12,2) NOT NULL DEFAULT 0`);

        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "name" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "price" TYPE numeric(12,2) USING round("price"::numeric, 2)`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "points" TYPE numeric(12,2) USING round("points"::numeric, 2)`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "cost" TYPE numeric(12,2) USING round("cost"::numeric, 2)`);

        await this.addCheck(queryRunner, "CHK_products_price_non_negative", `"price" >= 0`);
        await this.addCheck(queryRunner, "CHK_products_points_non_negative", `"points" >= 0`);
        await this.addCheck(queryRunner, "CHK_products_cost_non_negative", `"cost" >= 0`);
        await this.addCheck(queryRunner, "CHK_products_stock_non_negative", `"stock" >= 0`);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_active_name" ON "products" ("active", "name")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_name" ON "products" ("name")`);

        await queryRunner.query(`ALTER TABLE "product_claims" ADD COLUMN IF NOT EXISTS "product_id" uuid NULL`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD COLUMN IF NOT EXISTS "product_name" varchar(180) NULL`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD COLUMN IF NOT EXISTS "price" numeric(12,2) NULL`);
        await queryRunner.query(`ALTER TABLE "product_claims" ALTER COLUMN "price" TYPE numeric(12,2) USING round("price"::numeric, 2)`);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_product_claims_product'
                ) THEN
                    ALTER TABLE "product_claims"
                    ADD CONSTRAINT "FK_product_claims_product"
                    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL;
                END IF;
            END
            $$;
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_claims_product_id" ON "product_claims" ("product_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_claims_product_id"`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP CONSTRAINT IF EXISTS "FK_product_claims_product"`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP COLUMN IF EXISTS "price"`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP COLUMN IF EXISTS "product_name"`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP COLUMN IF EXISTS "product_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_name"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_active_name"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "CHK_products_stock_non_negative"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "CHK_products_cost_non_negative"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "CHK_products_points_non_negative"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "CHK_products_price_non_negative"`);
    }

    private async addCheck(queryRunner: QueryRunner, name: string, expression: string): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = '${name}'
                ) THEN
                    ALTER TABLE "products" ADD CONSTRAINT "${name}" CHECK (${expression});
                END IF;
            END
            $$;
        `);
    }
}
