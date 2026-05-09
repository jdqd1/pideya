import { MigrationInterface, QueryRunner } from "typeorm";

export class CascadeDeleteUserActivity1765078269762 implements MigrationInterface {
    name = 'CascadeDeleteUserActivity1765078269762'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_activity" DROP CONSTRAINT "FK_11108754ec780c670440e32baad"`);
        await queryRunner.query(`ALTER TABLE "user_activity" ALTER COLUMN "user_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_activity" ADD CONSTRAINT "FK_11108754ec780c670440e32baad" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_activity" DROP CONSTRAINT "FK_11108754ec780c670440e32baad"`);
        await queryRunner.query(`ALTER TABLE "user_activity" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_activity" ADD CONSTRAINT "FK_11108754ec780c670440e32baad" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
