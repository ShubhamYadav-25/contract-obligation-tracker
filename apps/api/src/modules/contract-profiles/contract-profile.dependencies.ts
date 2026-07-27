import { getApplicationDatabase } from "../../infrastructure/database/app-database.js";
import { PostgresContractProfileRepository } from "./postgres-contract-profile.repository.js";

export function createContractProfileDependencies() {
  const database = getApplicationDatabase();
  return {
    database,
    profiles: new PostgresContractProfileRepository(database),
  };
}
