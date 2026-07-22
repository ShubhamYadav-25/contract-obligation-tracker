import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";

function readContractIds(): readonly string[] {
  const value = process.env.CHECK_CONTRACT_IDS;
  if (!value) {
    throw new Error("CHECK_CONTRACT_IDS is required");
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const database = new PgPoolClient(createDatabaseConfig(loadEnv()));
  const contractIds = readContractIds();

  try {
    const result = await database.query<{
      readonly contract_id: string;
      readonly obligations: number;
      readonly with_boxes: number;
    }>(
      `
        SELECT
          contract_id,
          COUNT(*)::int AS obligations,
          COUNT(*) FILTER (WHERE anchors::text LIKE '%"boxes"%')::int AS with_boxes
        FROM obligations
        WHERE contract_id = ANY($1::uuid[])
        GROUP BY contract_id
        ORDER BY contract_id
      `,
      [contractIds],
    );

    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    await database.close();
  }
}

main().catch((error) => {
  console.error("anchor_box_check_failed", error);
  process.exitCode = 1;
});
