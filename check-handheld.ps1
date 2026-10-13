$r = Invoke-WebRequest -Uri http://localhost:3000/handheld -UseBasicParsing
$r.StatusCode
$r.Content.Length
$r.Headers["permissions-policy"]