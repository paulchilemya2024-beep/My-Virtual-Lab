const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const experiments = require('./src/data/experiments.json');
const Experiment = require('./src/models/Experiment');

async function main() {
  await connectDB();

  for (const exp of experiments) {
    await Experiment.findByIdAndUpdate(exp._id, exp, { upsert: true, new: true, setDefaultsOnInsert: true });
    console.log(`Inserted ${exp._id}`);
  }

  const count = await Experiment.countDocuments();
  console.log(`Total experiments: ${count}`);

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
