const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const liveDbPath = path.join(process.env.APPDATA || "", "9router", "db", "data.sqlite");

console.log("Running self-check for Live Monitoring Panel...");

// 1. Live DB must exist and be accessible
assert(fs.existsSync(liveDbPath), `Live DB must exist at ${liveDbPath}`);
const liveDb = new DatabaseSync(liveDbPath, { readOnly: true });

// 2. Total accounts
const liveCountRow = liveDb.prepare("SELECT count(*) as c FROM providerConnections").get();
assert(liveCountRow.c > 0, "Live DB should contain providerConnections");
console.log(`✓ Live DB readable: Found ${liveCountRow.c} accounts.`);

// 3. Member API keys
const keysCount = liveDb.prepare("SELECT count(*) as c FROM apiKeys").get();
assert(keysCount.c > 0, "Live DB should contain apiKeys");
console.log(`✓ Member API Keys verified: ${keysCount.c} keys.`);

// 4. Usage history
const usageCount = liveDb.prepare("SELECT count(*) as c FROM usageHistory").get();
assert(usageCount.c > 0, "Live DB should contain usageHistory");
console.log(`✓ Usage history verified: ${usageCount.c} completion records.`);

liveDb.close();

console.log("\nAll self-check tests passed successfully!");
