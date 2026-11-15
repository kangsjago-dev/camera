$urls = @(
  "https://www.runway.my.id/cam",
  "https://www.runway.my.id/cam/",
  "https://runway.my.id/cam",
  "https://camera-blush-theta.vercel.app/cam",
  "https://camera-blush-theta.vercel.app/cam/"
)

foreach ($u in $urls) {
  try {
    $req = [System.Net.WebRequest]::Create($u)
    $req.AllowAutoRedirect = $false
    $req.Timeout = 5000
    $res = $req.GetResponse()
    Write-Host "$u -> $([int]$res.StatusCode) $($res.StatusDescription) | Location: $($res.Headers['Location']) | Server: $($res.Headers['Server'])"
    $res.Close()
  } catch [System.Net.WebException] {
    $resp = $_.Exception.Response
    if ($resp) {
      Write-Host "$u -> $([int]$resp.StatusCode) $($resp.StatusDescription) | Location: $($resp.Headers['Location']) | Server: $($resp.Headers['Server']) | VercelError: $($resp.Headers['x-vercel-error'])"
      $resp.Close()
    } else {
      Write-Host "$u -> Error: $_"
    }
  }
}

