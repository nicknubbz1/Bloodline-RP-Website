const http = require("http");
const fs = require("fs");
const path = require("path");

const port = 5500;
const root = process.cwd();

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  const cleanUrl = decodeURIComponent((req.url || "/").split("?")[0]);
  const relativePath = cleanUrl === "/" ? "index.html" : cleanUrl.replace(/^\//, "");
  const fullPath = path.resolve(root, relativePath);

  if (!fullPath.startsWith(root)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log("Bloodline RP site is live at http://localhost:" + port);
});
