/**
 * Approves a vendor by Firebase uid, matching the pattern used by
 * seed-jobs.js / seed-admin.js in the other Crafteey apps.
 *
 * Usage: node scripts/seed-vendor.js <firebase-uid>
 */
require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/seed-vendor.js <firebase-uid>");
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const Vendor = mongoose.model(
    "Vendor",
    new mongoose.Schema({}, { strict: false })
  );

  const result = await Vendor.findOneAndUpdate(
    { uid },
    { $set: { status: "approved" } },
    { new: true }
  );

  if (!result) {
    console.log("No vendor found with that uid.");
  } else {
    console.log(`Approved vendor: ${result.businessName}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
