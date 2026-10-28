import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { startGoldRateCron } from './jobs/goldRateCron.js';

await connectDb();
startGoldRateCron();
createApp().listen(env.port, () => console.log(`Fringlale API on :${env.port}`));
