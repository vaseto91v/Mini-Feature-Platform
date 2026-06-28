import { buildApp } from "./app";
import { env } from "./config/env";
import { buildContainer } from "./container";
import { closeDb } from "./db/client";

const deps = buildContainer();
const app = buildApp(deps);
deps.dispatcher.start();

async function shutdown(signal: string): Promise<void> {
  app.log.info(`Received ${signal}, shutting down`);
  deps.dispatcher.stop();
  await app.close();
  await closeDb();
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void shutdown(signal));
}

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then((address) => app.log.info(`API listening on ${address}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
