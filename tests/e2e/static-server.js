const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".jsx": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

// `basePath` mirrors how GitHub Pages actually serves this app: a project
// site lives under https://<user>.github.io/<repo>/, never at the domain
// root. Serving the tests from a sub-path too means any root-absolute URL
// in index.html ("/styles.js") 404s here exactly like it does in
// production, instead of silently working because the test server happens
// to be rooted at "/".
function startServer(root, basePath = "") {
  const prefix = basePath.replace(/\/+$/, "");
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = decodeURIComponent(req.url.split("?")[0]);
      if (prefix) {
        if (filePath === prefix) filePath = "/index.html";
        else if (filePath.startsWith(prefix + "/")) filePath = filePath.slice(prefix.length);
        else {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
      }
      if (filePath === "/") filePath = "/index.html";
      const full = path.join(root, filePath);
      fs.readFile(full, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}${prefix}`, close: () => server.close() });
    });
  });
}

module.exports = { startServer };
