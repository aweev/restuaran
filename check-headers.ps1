$r = Invoke-WebRequest -Uri http://localhost:3100/login -Method Head -UseBasicParsing
$r.Headers