import { MigrationInterface, QueryRunner } from "typeorm";

export class CascadeDeleteUsers1765078172601 implements MigrationInterface {
    name = 'CascadeDeleteUsers1765078172601'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_claims" DROP CONSTRAINT "fk_product_claim_user"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "fk_coupon_user"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "fk_coupon_verified_by"`);
        await queryRunner.query(`ALTER TABLE "user_levels" DROP CONSTRAINT "fk_user_levels_user"`);
        await queryRunner.query(`DROP INDEX "public"."users_email_idx"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_levels_level"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_levels_window"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP COLUMN "claimed_at"`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD "claimed_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "expires_at"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "expires_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "used_at"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "used_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "level_id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "window_start" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "window_end" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "awarded_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_levels" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "user_levels" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_levels" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "user_levels" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "user_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD CONSTRAINT "FK_bf3f138a13e575af41c4e2896e5" FOREIGN KEY ("claimed_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "FK_9974c02e617aa96ddafd8404323" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "FK_629e17389a3d6e8a4c98128035f" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_levels" ADD CONSTRAINT "FK_e715664e276e41f2f18bc99421f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_levels" DROP CONSTRAINT "FK_e715664e276e41f2f18bc99421f"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "FK_629e17389a3d6e8a4c98128035f"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "FK_9974c02e617aa96ddafd8404323"`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP CONSTRAINT "FK_bf3f138a13e575af41c4e2896e5"`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_levels" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "user_levels" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_levels" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "user_levels" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "awarded_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "window_end" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "window_start" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_levels" ALTER COLUMN "level_id" SET DEFAULT 'nivel-0'`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "used_at"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "used_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "expires_at"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "expires_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP COLUMN "claimed_at"`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD "claimed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "product_claims" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "idx_user_levels_window" ON "user_levels" ("window_end") `);
        await queryRunner.query(`CREATE INDEX "idx_user_levels_level" ON "user_levels" ("level_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email") `);
        await queryRunner.query(`ALTER TABLE "user_levels" ADD CONSTRAINT "fk_user_levels_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "fk_coupon_verified_by" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "fk_coupon_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_claims" ADD CONSTRAINT "fk_product_claim_user" FOREIGN KEY ("claimed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
