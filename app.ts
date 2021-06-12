import { ccxt, delay, influx } from "./deps.ts";

const BTCUSD = "BTC/USD";
const FETCH_BALANCE_INTERVAL = 60_000;

const apiKey = Deno.env.get("CCXT_API_KEY") ?? "";
const secret = Deno.env.get("CCXT_API_SECRET") ?? "";
const apiKey2 = Deno.env.get("CCXT_API_KEY2") ?? "";
const secret2 = Deno.env.get("CCXT_API_SECRET2") ?? "";
const testnet = !!Deno.env.get("TESTNET") ?? false;

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

const main = async () => {
  const ec = new ccxt.bybit({ apiKey, secret, enableRateLimit: true });
  const ec2 = new ccxt.bybit({
    apiKey: apiKey2,
    secret: secret2,
    enableRateLimit: true,
  });

  if (testnet) {
    ec.urls.api = ec.urls.test;
    ec2.urls.api = ec2.urls.test;
  }

  try {
    while (true) {
      const balance = await ec.fetchBalance();
      const balance2 = await ec2.fetchBalance();
      console.log({ balance, balance2 });
      const btc = balance.BTC.total;
      const btc2 = balance2.BTC.total;
      console.log({ btc, btc2 });
      // write point with the current (client-side) timestamp
      const point1 = new influx.Point("BTC")
        .tag("exchange", "ex1")
        .tag("type", "total")
        .floatField("value", btc);
      writeApi.writePoint(point1);
      console.log(` ${point1}`);
      const point2 = new influx.Point("BTC")
        .tag("exchange", "ex2")
        .tag("type", "total")
        .floatField("value", btc2);
      writeApi.writePoint(point2);
      console.log(` ${point2}`);
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
