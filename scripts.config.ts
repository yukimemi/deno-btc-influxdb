import { DenonConfig } from "https://deno.land/x/denon/mod.ts";

const config: DenonConfig = {
  scripts: {
    start: {
      cmd: "deno run --unstable -A app.ts",
      desc: "run my app.ts file",
    },
    test: {
      cmd: "deno test --unstable -A",
      desc: "test all files",
    },
  },
};

export default config;
