const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const port = 5500;
const clients = new Set();
let reloadTimer = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const liveReloadScript = `
<script>
  (() => {
    const source = new EventSource('/__live_reload');
    source.onmessage = (event) => {
      if (event.data === 'reload') {
        window.location.reload();
      }
    };
    source.onerror = () => {
      // EventSource auto-reconnects by default. Avoid forced full reload loops.
    };
  })();
</script>`;

function safePathFromUrl(urlPath) {
  const cleaned = decodeURIComponent((urlPath || "/").split("?")[0]);
  const relativePath = cleaned === "/" ? "index.html" : cleaned.replace(/^\//, "");
  const fullPath = path.resolve(root, relativePath);
  if (!fullPath.startsWith(root)) {
    return null;
  }
  return fullPath;
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/__live_reload")) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    res.write("\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  const fullPath = safePathFromUrl(req.url || "/");
  if (!fullPath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const type = mimeTypes[ext] || "application/octet-stream";

    if (ext === ".html") {
      let html = data.toString("utf8");
      if (html.includes("</body>")) {
        html = html.replace("</body>", `${liveReloadScript}\n</body>`);
      } else {
        html += liveReloadScript;
      }
      res.writeHead(200, { "Content-Type": type });
      res.end(html);
      return;
    }

    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
});

fs.watch(root, { recursive: true }, (_eventType, filename) => {
  if (!filename) {
    return;
  }

  // Ignore hidden temp files and node_modules noise.
  if (filename.includes("node_modules") || filename.startsWith(".")) {
    return;
  }

  if (reloadTimer) {
    clearTimeout(reloadTimer);
  }

  reloadTimer = setTimeout(() => {
    for (const client of clients) {
      client.write("data: reload\n\n");
    }
  }, 120);
});

server.listen(port, () => {
  console.log(`Live server running at http://localhost:${port}`);
  console.log("Auto reload is enabled. Save a file to refresh the browser.");
});
