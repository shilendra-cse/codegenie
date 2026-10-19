import http from "node:http";

const todos = [
  { id: 1, title: "Write the README", done: true },
  { id: 2, title: "Add tests", done: false },
];

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createApp() {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/todos") {
      return sendJson(res, 200, todos);
    }
    return sendJson(res, 404, { error: "Not found" });
  });
}
