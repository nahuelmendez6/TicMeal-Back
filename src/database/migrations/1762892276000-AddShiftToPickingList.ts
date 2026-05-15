import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from "typeorm";

export class AddShiftToPickingList1762892276000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add shift_id column
        await queryRunner.addColumn(
            "picking_lists",
            new TableColumn({
                name: "shift_id",
                type: "int",
                isNullable: true,
            })
        );

        // 2. Add Foreign Key
        await queryRunner.createForeignKey(
            "picking_lists",
            new TableForeignKey({
                columnNames: ["shift_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "shifts",
                onDelete: "SET NULL",
            })
        );

        // 3. Add Unique Index (company_id, date, shift_id)
        await queryRunner.createIndex(
            "picking_lists",
            new TableIndex({
                name: "IDX_PICKING_LIST_TENANT_DATE_SHIFT",
                columnNames: ["company_id", "date", "shift_id"],
                isUnique: true,
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("picking_lists");
        
        // Remove Index
        await queryRunner.dropIndex("picking_lists", "IDX_PICKING_LIST_TENANT_DATE_SHIFT");

        // Remove Foreign Key
        const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("shift_id") !== -1);
        if (foreignKey) {
            await queryRunner.dropForeignKey("picking_lists", foreignKey);
        }

        // Remove Column
        await queryRunner.dropColumn("picking_lists", "shift_id");
    }
}
