#!/usr/bin/env node
/** Poll a URL until it returns HTTP 200, or exit 1. */
const url = process.argv[2] || "http://127.0.0.1:8080/";
const timeoutMs = Number(process.env.WAIT_HTTP_TIMEOUT_MS || 60000);
const start = Date.now();

while (Date.now() - start < timeoutMs) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (res.status === 200) {
      console.log(`ready ${url} ${res.status}`);
      process.exit(0);
    }
    console.log(`waiting ${url} ${res.status}`);
  } catch (err) {
    console.log(`waiting ${url} ${err?.cause?.code || err?.message || err}`);
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.error(`timeout waiting for HTTP 200 from ${url}`);
process.exit(1);
