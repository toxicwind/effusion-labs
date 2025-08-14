### Bring up
make up

### Raw Markdown response
curl -s -X POST "http://localhost:49159/v1?fmt=md" \
  -u toxic:Ann3xx\!5G7e5Bmx \
  -H "Accept: text/markdown" -H "Content-Type: application/json" \
  --data '{"cmd":"request.get","url":"https://m.popmart.com/us/products/578/labubu-time-to-chill-vinyl-plush-doll","maxTimeout":60000}' | sed -n '1,60p'

### JSON with embedded Markdown
curl -s -X POST "http://localhost:49159/v1" \
  -u toxic:Ann3xx\!5G7e5Bmx \
  -H "Content-Type: application/json" \
  --data '{"cmd":"request.get","url":"https://m.popmart.com/us/products/1874/","maxTimeout":60000}' | jq -r '.solution.format, .solution.title, (.solution.markdown|.[0:140])'

### Deep probe
curl -s -X POST "http://localhost:49159/health/deep" -u toxic:Ann3xx\!5G7e5Bmx | jq
