import { ccxt, delay, influx } from "./deps.ts";

const BTCUSD = "BTC/USD";
const FETCH_BALANCE_INTERVAL = 30_000;

const apiKey = Deno.env.get("CCXT_API_KEY") ?? "";
const secret = Deno.env.get("CCXT_API_SECRET") ?? "";
const apiKey2 = Deno.env.get("CCXT_API_KEY2") ?? "";
const secret2 = Deno.env.get("CCXT_API_SECRET2") ?? "";
const testnet = !!Deno.env.get("TESTNET") ?? false;

const apiKeyProd = Deno.env.get("CCXT_API_KEY_PROD") ?? "";
const secretProd = Deno.env.get("CCXT_API_SECRET_PROD") ?? "";

const influxUrl = Deno.env.get("INFLUX_URL") ?? "";
const influxToken = Deno.env.get("INFLUX_TOKEN") ?? "";
const influxOrg = Deno.env.get("INFLUX_ORG") ?? "";
const influxBucket = Deno.env.get("INFLUX_BUCKET") ?? "";

// const ACCOUNT = "gce-btc-test";

// create a write API, expecting point timestamps in nanoseconds (can be also 's', 'ms', 'us')
const writeApi = new influx.InfluxDB({ url: influxUrl, token: influxToken })
  .getWriteApi(
    influxOrg,
    influxBucket,
    "ms",
  );
// setup default tags for all writes through this API
// writeApi.useDefaultTags({ account: ACCOUNT });

const logTicker = async (ec: ccxt.Exchange, now: Date) => {
  const tick = await ec.fetchTicker(BTCUSD);
  const point = new influx.Point("BTC")
    .tag("exchange", "BTCUSD")
    .tag("price", "close")
    .floatField("value", tick.close).timestamp(now);
  writeApi.writePoint(point);
  console.log(` ${point}`);
};

const logBalance = async (ec: ccxt.Exchange, name: string, now: Date) => {
  const balance = await ec.fetchBalance();
  const btc = balance.BTC;
  // write point with the current (client-side) timestamp
  ["free", "used", "total"].forEach((t) => {
    const type = t as keyof typeof balance.BTC;
    const point = new influx.Point("BTC")
      .tag("exchange", name)
      .tag("type", t)
      .floatField("value", btc[type]).timestamp(now);
    writeApi.writePoint(point);
    console.log(` ${point}`);
  });
};

const main = async () => {
  const ec = new ccxt.bybit({ apiKey, secret, enableRateLimit: true });
  const ec2 = new ccxt.bybit({
    apiKey: apiKey2,
    secret: secret2,
    enableRateLimit: true,
  });
  const ecProd = new ccxt.bybit({
    apiKey: apiKeyProd,
    secret: secretProd,
    enableRateLimit: true,
  });

  if (testnet) {
    ec.urls.api = ec.urls.test;
    ec2.urls.api = ec2.urls.test;
  }

  try {
    while (true) {
      const now = new Date();
      await logBalance(ec, "ex1", now);
      await logBalance(ec2, "ex2", now);
      await logBalance(ecProd, "exProd1", now);
      await logTicker(ec, now);
      await delay(FETCH_BALANCE_INTERVAL);
    }
  } catch (e) {
    console.error({ e });
  } finally {
    writeApi
      .close()
      .then(() => {
        console.log("FINISHED ... ");
      })
      .catch((e: Error) => {
        console.error(e);
        if (e instanceof influx.HttpError && e.statusCode === 401) {
          console.log("Setup a new InfluxDB database.");
        }
        console.log("\nFinished ERROR");
      });
  }
};

await main();
