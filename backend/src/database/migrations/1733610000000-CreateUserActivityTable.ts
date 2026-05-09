import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm"

export class CreateUserActivityTable1733610000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "user_activity",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "uuid",
                    },
                    {
                        name: "type",
                        type: "varchar",
                        length: "20",
                    },
                    {
                        name: "data",
                        type: "jsonb",
                        isNullable: true,
                    },
                    {
                        name: "user_id",
                        type: "uuid",
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()",
                    },
                ],
            }),
            true,
        )

        await queryRunner.createForeignKey(
            "user_activity",
            new TableForeignKey({
                columnNames: ["user_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "users",
                onDelete: "CASCADE",
            }),
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("user_activity")
        const foreignKey = table!.foreignKeys.find(fk => fk.columnNames.indexOf("user_id") !== -1)
        await queryRunner.dropForeignKey("user_activity", foreignKey!)
        await queryRunner.dropTable("user_activity")
    }
}
