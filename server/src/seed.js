// Seeds the Experiments collection from data/experiments.json.
// Run once after connecting your database:  npm run seed
const mongoose = require('mongoose');
const experiments = require('./data/experiments.json');
const Experiment = require('./models/Experiment');
const connectDB = require('./config/db');

async function seed() {
  await connectDB();

  console.log(`Seeding ${experiments.length} experiments...`);
  for (const exp of experiments) {
    // upsert so re-running the seed updates existing docs instead of erroring.
    await Experiment.findByIdAndUpdate(exp._id, exp, { upsert: true, new: true, setDefaultsOnInsert: true });
    console.log(`  ✔ ${exp._id} — ${exp.title}`);
  }

  // Remove any experiments that are no longer in the JSON (e.g. deleted labs),
  // so the app's catalogue always mirrors this file exactly.
  const keepIds = experiments.map((e) => e._id);
  const removed = await Experiment.deleteMany({ _id: { $nin: keepIds } });
  if (removed.deletedCount > 0) console.log(`  ✂ removed ${removed.deletedCount} stale experiment(s)`);

  const experimentsRouter = require('./routes/experiments');
  experimentsRouter.cache.clear();

  console.log('✅ Seed complete.');
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
