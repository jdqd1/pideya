import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPhoneToUsers1734390000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("users", new TableColumn({
            name: "phone_number",
            type: "varchar",
            length: "20",
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("users", "phone_number");
    }

}
