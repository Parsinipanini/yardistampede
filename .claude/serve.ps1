$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$prefix = 'http://localhost:8080/'

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $root on $prefix"

$mime = @{
  '.html'='text/html';   '.htm'='text/html';
  '.css'='text/css';     '.js'='application/javascript';
  '.json'='application/json';
  '.svg'='image/svg+xml';'.png'='image/png';'.jpg'='image/jpeg';'.jpeg'='image/jpeg';'.gif'='image/gif';'.webp'='image/webp';
  '.mp4'='video/mp4';    '.webm'='video/webm';'.mp3'='audio/mpeg';'.wav'='audio/wav';
  '.woff'='font/woff';   '.woff2'='font/woff2';'.ttf'='font/ttf';'.otf'='font/otf';
  '.ico'='image/x-icon'; '.txt'='text/plain';
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
      $full = Join-Path $root $rel
      if ((Test-Path $full -PathType Container)) { $full = Join-Path $full 'index.html' }
      if (Test-Path $full -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($full).ToLower()
        $type = $mime[$ext]; if (-not $type) { $type = 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $res.ContentType = $type
        $res.ContentLength64 = $bytes.Length
        $res.Headers['Cache-Control'] = 'no-store'
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host "200 $rel"
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 $rel")
        $res.OutputStream.Write($msg, 0, $msg.Length)
        Write-Host "404 $rel"
      }
    } catch {
      $res.StatusCode = 500
      Write-Host "500 $($_.Exception.Message)"
    } finally {
      $res.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
}
