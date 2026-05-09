import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTicketExchangeRate1773000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn("tickets", "exchange_rate");
        if (!hasColumn) {
            await queryRunner.addColumn("tickets", new TableColumn({
                name: "exchange_rate",
                type: "float",
                isNullable: true,
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn("tickets", "exchange_rate");
        if (hasColumn) {
            await queryRunner.dropColumn("tickets", "exchange_rate");
        }
    }

}
