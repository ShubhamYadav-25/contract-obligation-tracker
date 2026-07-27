import { getApplicationDatabase } from "../../infrastructure/database/app-database.js";
import { OperationsReadRepository } from "./operations.repository.js";

export function createOperationsDependencies() {
  const database = getApplicationDatabase();
  return { database, operations: new OperationsReadRepository(database) };
}
