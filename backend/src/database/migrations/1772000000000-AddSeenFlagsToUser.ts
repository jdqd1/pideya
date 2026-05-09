import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class AddSeenFlagsToUser1772000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "users",
            new TableColumn({
                name: "has_seen_welcome",
                type: "boolean",
                default: false,
            })
        )

        await queryRunner.addColumn(
            "users",
            new TableColumn({
                name: "has_seen_first_coupon",
                type: "boolean",
                default: false,
            })
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("users", "has_seen_first_coupon")
        await queryRunner.dropColumn("users", "has_seen_welcome")
    }

}
