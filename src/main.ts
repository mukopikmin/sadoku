#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run --allow-env=BROWSER,HOME,XDG_CONFIG_HOME,XDG_DATA_HOME,APPDATA,SADOKU_COMMENTS_DIR,MDVIEW_COMMENTS_DIR
import { runApp } from "./server/app.ts";

Deno.exitCode = await runApp(Deno.args);
