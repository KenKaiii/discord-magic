import { createServer, type Server } from "node:http";

/** Railway's healthcheck hits /health; it returns 503 until the bot is connected to Discord. */
export function startHealthServer(port: number, isReady: () => boolean): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      const ready = isReady();
      res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: ready ? "ok" : "starting" }));
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve(server));
  });
}
