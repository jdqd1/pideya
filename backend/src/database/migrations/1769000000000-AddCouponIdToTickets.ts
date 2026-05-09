import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCouponIdToTickets1769000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn("tickets", "coupon_id");
        if (!hasColumn) {
            await queryRunner.addColumn("tickets", new TableColumn({
                name: "coupon_id",
                type: "uuid",
                isNullable: true
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("tickets", "coupon_id");
    }

}
