$r = Invoke-WebRequest -Uri http://localhost:3100/handheld -UseBasicParsing
$r.StatusCode
$r.Content.Length
$r.Headers["permissions-policy"]