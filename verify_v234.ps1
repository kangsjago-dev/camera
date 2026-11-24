Start-Sleep -Seconds 6

$urls = @(
  "https://camera-blush-theta.vercel.app",
  "https://www.runway.my.id/cam"
)

foreach ($u in $urls) {
  try {
    $res = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10
    $hasV234 = $res.Content.Contains('v=2.3.4')
    Write-Host "$u -> Status: $($res.StatusCode), Length: $($res.Content.Length), HasV234: $hasV234"
  } catch {
    Write-Host "$u -> Error: $_"
  }
}

