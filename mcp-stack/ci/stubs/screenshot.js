import { readFileSync } from 'node:fs'
import http from 'node:http'
const data = readFileSync(new URL('./data/screenshot.json', import.meta.url))
http
  .createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(data)
  })
  .listen(9340, '127.0.0.1')
