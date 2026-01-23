import { readFileSync } from 'node:fs'
import http from 'node:http'
const data = readFileSync(new URL('./data/searxng.json', import.meta.url))
http
  .createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(data)
  })
  .listen(8080, '127.0.0.1')
