#!/usr/bin/env node

function failRetiredSurface(surface) {
  console.error(
    `[retired] ${surface || "This operator surface"} has been retired from xdragon-site. Use the equivalent tooling in the command repo instead.`
  );
  process.exit(1);
}

if (require.main === module) {
  failRetiredSurface(process.argv[2]);
}

module.exports = {
  failRetiredSurface,
};
