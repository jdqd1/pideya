import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCedulaToUsers1765080000000 implements MigrationInterface {
    name = 'AddCedulaToUsers1765080000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "cedula" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_cedula" UNIQUE ("cedula")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_cedula"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "cedula"`);
    }
}
