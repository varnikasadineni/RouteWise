import neo4j, { Driver } from "neo4j-driver";
let driver: Driver | undefined;
export function getNeo4jDriver() {
  if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD)
    throw new Error("Set NEO4J_URI, NEO4J_USERNAME and NEO4J_PASSWORD in .env.local");
  if (!driver)
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
    );
  return driver;
}
export const neoDatabase = process.env.NEO4J_DATABASE || "neo4j";
