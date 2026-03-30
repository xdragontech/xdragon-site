#!/usr/bin/env node

const surface = process.argv[2] || "This operator surface";

console.error(
  `[retired] ${surface} has been retired from xdragon-site. Use the equivalent tooling in the command repo instead.`
);
process.exit(1);
