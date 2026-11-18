# Shir Chadash - local server: static site + data API + back office
# Run: powershell -ExecutionPolicy Bypass -File server.ps1 [-Port 8765]
param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web.Extensions

$root = $PSScriptRoot
$dataDir = Join-Path $root 'data'
$uploadDir = Join-Path $root 'uploads'
$dbPath = Join-Path $dataDir 'db.json'
$seedPath = Join-Path $dataDir 'seed.json'
$adminPath = Join-Path $dataDir 'admin.json'
foreach ($d in @($dataDir, $uploadDir)) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null } }

$js = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$js.MaxJsonLength = [int]::MaxValue
$js.RecursionLimit = 256
$utf8 = New-Object System.Text.UTF8Encoding $false
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

function NowMs { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
function RandHex([int]$n) { $b = New-Object byte[] $n; $rng.GetBytes($b); -join ($b | ForEach-Object { $_.ToString('x2') }) }
function WriteFileSafe($path, $text) {
  $tmp = "$path.tmp"
  [IO.File]::WriteAllText($tmp, $text, $utf8)
  if (Test-Path $path) { [IO.File]::Replace($tmp, $path, [NullString]::Value) } else { [IO.File]::Move($tmp, $path) }
}

# ---------- database ----------
# db.json is created on first admin setup (the admin page sends the initial content from config.js)
$db = $null
if (Test-Path $dbPath) { $db = $js.DeserializeObject([IO.File]::ReadAllText($dbPath, $utf8)) }
function Valid-Db($n) { ($n -is [System.Collections.IDictionary]) -and ($n['config'] -is [System.Collections.IDictionary]) -and ($null -ne $n['donations']) }
function SaveDb { WriteFileSafe $dbPath ($js.Serialize($db)) }
function Cfg { $db['config'] }
function Has($d, $k) { if ($null -eq $d -or $d -isnot [System.Collections.IDictionary]) { return $false }; return $null -ne $d[$k] }
function Num($v) { if ($null -eq $v -or "$v" -eq '') { 0 } else { [double]$v } }

function Get-Status {
  $c = Cfg; $now = NowMs
  if ((Has $c 'startsAt') -and $now -lt (Num $c['startsAt'])) { return 'upcoming' }
  if ((Has $c 'endsAt') -and $now -ge (Num $c['endsAt'])) { return 'ended' }
  return 'live'
}
function Get-Raised {
  $sum = Num (Cfg)['baseRaised']
  foreach ($d in $db['donations']) { if ($d['status'] -eq 'paid') { $sum += Num $d['credited'] } }
  return $sum
}
function Get-Credit([double]$base) {
  $c = Cfg; $mult = Num $c['multiplier']
  if ((Get-Status) -ne 'live' -or $mult -le 1) { return $base }
  $room = [Math]::Max(0, (Num $c['goal']) - (Get-Raised) - $base)
  return $base + [Math]::Min($base * ($mult - 1), $room)
}

# ---------- admin auth ----------
# sessions are keyed by SHA-256 of the cookie token, so sessions.json never holds a usable token.
# "remember me" sessions (30 days) are saved to disk and survive a server restart; normal ones (12h, browser session) are memory only.
$sessionsPath = Join-Path $dataDir 'sessions.json'
$sessions = @{}
$script:fails = 0; $script:lockUntil = 0
function TokKey([string]$t) {
  $h = [System.Security.Cryptography.SHA256]::Create()
  try { -join ($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($t)) | ForEach-Object { $_.ToString('x2') }) } finally { $h.Dispose() }
}
function Save-Sessions {
  $keep = @{}; $now = NowMs
  foreach ($k in @($sessions.Keys)) {
    $s = $sessions[$k]
    if ($s['exp'] -lt $now) { $sessions.Remove($k) } elseif ($s['remember']) { $keep[$k] = $s }
  }
  WriteFileSafe $sessionsPath ($js.Serialize($keep))
}
if (Test-Path $sessionsPath) {
  try {
    $saved = $js.DeserializeObject([IO.File]::ReadAllText($sessionsPath, $utf8))
    foreach ($k in $saved.Keys) {
      $v = $saved[$k]
      if ((Num $v['exp']) -gt (NowMs)) { $sessions[$k] = @{ exp = [int64](Num $v['exp']); uid = [string]$v['uid']; remember = $true } }
    }
  } catch { Write-Host 'sessions.json unreadable - ignored' }
}
function Hash-Pw([string]$pw, [byte[]]$salt) {
  $k = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($pw, $salt, 120000, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
  [Convert]::ToBase64String($k.GetBytes(32))
}
# users: data/admin.json = { users: [ { id, username, name, role: manager|viewer, salt, hash } ] }
#   manager = campaign manager (full access) | viewer = authorized viewer (read-only)
function Load-Users {
  if (-not (Test-Path $adminPath)) { return ,(New-Object System.Collections.ArrayList) }
  $rec = $js.DeserializeObject([IO.File]::ReadAllText($adminPath, $utf8))
  $list = New-Object System.Collections.ArrayList
  if ($rec -is [System.Collections.IDictionary] -and (Has $rec 'hash')) {
    # legacy single-password file -> one manager user named admin
    [void]$list.Add(@{ id = 'u' + (RandHex 4); username = 'admin'; name = ''; role = 'manager'; salt = $rec['salt']; hash = $rec['hash']; updatedAt = (NowMs) })
    Save-Users $list
    return ,$list
  }
  foreach ($u in @($rec['users'])) { if ($u) { [void]$list.Add($u) } }
  return ,$list
}
function Save-Users($list) { WriteFileSafe $adminPath ($js.Serialize(@{ users = $list.ToArray() })) }
function New-PwFields([string]$pw) {
  $salt = New-Object byte[] 16; $rng.GetBytes($salt)
  return @{ salt = [Convert]::ToBase64String($salt); hash = (Hash-Pw $pw $salt) }
}
function Test-UserPw($u, [string]$pw) {
  if (-not $u) { return $false }
  $h = Hash-Pw $pw ([Convert]::FromBase64String($u['salt']))
  $a = [Text.Encoding]::ASCII.GetBytes($h); $b = [Text.Encoding]::ASCII.GetBytes($u['hash'])
  if ($a.Length -ne $b.Length) { return $false }
  $diff = 0; for ($i = 0; $i -lt $a.Length; $i++) { $diff = $diff -bor ($a[$i] -bxor $b[$i]) }
  return $diff -eq 0
}
function Find-User($list, [string]$key, [string]$by = 'username') {
  foreach ($u in $list) { if ("$($u[$by])" -ieq $key) { return $u } }
  return $null
}
function Public-User($u) { @{ id = $u['id']; username = $u['username']; name = $u['name']; role = $u['role'] } }
function Count-Managers($list) { $n = 0; foreach ($u in $list) { if ($u['role'] -eq 'manager') { $n++ } }; $n }
function New-Session($res, $u, [bool]$remember = $false) {
  $tok = RandHex 32
  $life = $(if ($remember) { 30 * 24 * 3600000 } else { 12 * 3600000 })
  $sessions[(TokKey $tok)] = @{ exp = (NowMs) + $life; uid = $u['id']; remember = $remember }
  $cookie = "sid=$tok; HttpOnly; SameSite=Strict; Path=/"
  if ($remember) { $cookie += '; Max-Age=2592000'; Save-Sessions }
  $res.Headers.Add('Set-Cookie', $cookie)
}
function End-UserSessions([string]$uid, [string]$keep = '') {
  $keepKey = $(if ($keep) { TokKey $keep } else { '' })
  foreach ($k in @($sessions.Keys)) { if ($sessions[$k]['uid'] -eq $uid -and $k -ne $keepKey) { $sessions.Remove($k) } }
  Save-Sessions
}
# logged-in user or null; re-read from file on every request so role changes and deletions apply at once
function Get-SessionUser($req) {
  $c = $req.Cookies['sid']
  if (-not $c) { return $null }
  $key = TokKey $c.Value
  $s = $sessions[$key]
  if (-not $s -or $s['exp'] -lt (NowMs)) { if ($s) { $sessions.Remove($key); if ($s['remember']) { Save-Sessions } }; return $null }
  return Find-User (Load-Users) $s['uid'] 'id'
}
$validUsername = '^[A-Za-z0-9._-]{3,32}$'

# ---------- http helpers ----------
function Send($res, [int]$code, $obj) {
  $bytes = $utf8.GetBytes($js.Serialize($obj))
  $res.StatusCode = $code
  $res.ContentType = 'application/json; charset=utf-8'
  $res.Headers.Add('Cache-Control', 'no-store')
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}
function Fail($res, [int]$code, [string]$msg) { Send $res $code @{ ok = $false; error = $msg } }
function Read-Body($req) {
  if ($req.ContentLength64 -gt 15MB) { throw 'too-large' }
  $sr = New-Object IO.StreamReader($req.InputStream, $utf8)
  $txt = $sr.ReadToEnd(); $sr.Close()
  if (-not $txt) { return @{} }
  $o = $js.DeserializeObject($txt)
  if ($o -isnot [System.Collections.IDictionary]) { throw 'bad-json' }
  return $o
}
function Str($d, $k, [int]$max = 500) { if (Has $d $k) { $s = "$($d[$k])".Trim(); if ($s.Length -gt $max) { $s.Substring(0, $max) } else { $s } } else { '' } }

$mime = @{ '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.gif' = 'image/gif'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.mp4' = 'video/mp4'; '.woff2' = 'font/woff2' }
$rootFull = [IO.Path]::GetFullPath($root).TrimEnd('\') + '\'

function Serve-Static($req, $res) {
  $p = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
  if ($p -eq '') { $p = 'index.html' }
  if ($p -eq 'admin' -or $p -eq 'admin/') { $p = 'admin.html' }
  $ext = [IO.Path]::GetExtension($p).ToLower()
  if ($p -match '^(data|\.)' -or $p -match '[\\/]\.' -or -not $mime.ContainsKey($ext)) { $res.StatusCode = 404; return }
  $file = [IO.Path]::GetFullPath((Join-Path $root $p))
  if (-not $file.StartsWith($rootFull) -or -not (Test-Path $file -PathType Leaf)) { $res.StatusCode = 404; return }
  $res.ContentType = $mime[$ext]
  if ($ext -in '.html', '.js', '.css') { $res.Headers.Add('Cache-Control', 'no-cache') }
  if ($req.HttpMethod -eq 'HEAD') { return }
  $bytes = [IO.File]::ReadAllBytes($file)
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# ---------- public API ----------
function Public-Data {
  $c = Cfg; $pc = @{}
  foreach ($k in $c.Keys) { $pc[$k] = $c[$k] }
  # NOTE: never use Where-Object on data that gets serialized - it wraps items and breaks JavaScriptSerializer
  $tl = New-Object System.Collections.ArrayList
  foreach ($t in $c['teams']) { if ($t['status'] -ne 'pending' -and $t['status'] -ne 'hidden') { [void]$tl.Add($t) } }
  $pc['teams'] = $tl.ToArray()
  $list = New-Object System.Collections.ArrayList
  foreach ($d in $db['donations']) {
    if ($d['status'] -ne 'paid') { continue }
    $anon = [bool]$d['anon']
    [void]$list.Add(@{
      id = $d['id']; name = $(if ($anon) { '' } else { $d['name'] }); anon = $anon
      amount = $d['amount']; cur = $d['cur']; months = $d['months']; baseIls = $d['baseIls']; credited = $d['credited']
      teamId = $d['teamId']; dedicationId = $d['dedicationId']; dedication = $d['dedication']
      message = $(if ($d['hideMessage']) { '' } else { $d['message'] }); date = $d['date']
    })
  }
  return @{ ok = $true; config = $pc; donations = $list.ToArray(); now = (NowMs) }
}

# Israeli ID (teudat zehut) check digit. Returns the 9-digit id, or '' if invalid.
function Clean-IsraeliId($v) {
  $s = ([string]$v) -replace '[\s-]', ''
  if ($s -notmatch '^\d{5,9}$') { return '' }
  $id = $s.PadLeft(9, '0')
  if ($id -match '^0+$') { return '' }
  $sum = 0
  for ($i = 0; $i -lt 9; $i++) { $d = [int]([string]$id[$i]) * ($i % 2 + 1); if ($d -gt 9) { $d -= 9 }; $sum += $d }
  if ($sum % 10 -eq 0) { return $id } else { return '' }
}

function Api-Donate($req, $res) {
  $b = Read-Body $req; $c = Cfg
  $cur = $(if ($b['cur'] -eq 'USD') { 'USD' } else { 'ILS' })
  $rate = $(if ($cur -eq 'USD') { Num $c['usdRate'] } else { 1 })
  $amount = [Math]::Floor((Num $b['amount']))
  $months = [int](Num $b['months'])
  if ($months -notin 1, 12, 24, 36) { $months = 1 }
  $name = Str $b 'name' 80; $email = Str $b 'email' 120
  $baseIls = $amount * $months * $rate
  if ($baseIls -lt 10 -or $amount -gt 10000000) { return Fail $res 400 'amount' }
  if (-not $name) { return Fail $res 400 'name' }
  if ($email -notmatch '^\S+@\S+\.\S+$') { return Fail $res 400 'email' }
  # phone is required: 9-15 digits, may include spaces, dashes, brackets and a leading +
  $phone = Str $b 'phone' 30
  $phoneDigits = $phone -replace '\D', ''
  if ($phone -notmatch '^\+?[\d\s\-().]+$' -or $phoneDigits.Length -lt 9 -or $phoneDigits.Length -gt 15) { return Fail $res 400 'phone' }
  # ID number is collected only while the org has section 46 approval; never shown on the public site
  $idNumber = ''
  if ($c['section46'] -eq $true -and (Str $b 'idNumber' 12)) {
    $idNumber = Clean-IsraeliId (Str $b 'idNumber' 12)
    if (-not $idNumber) { return Fail $res 400 'idnum' }
  }

  $dedId = Str $b 'dedicationId' 40
  if ($dedId) {
    $ded = $c['dedications'] | Where-Object { $_['id'] -eq $dedId } | Select-Object -First 1
    if (-not $ded) { return Fail $res 400 'dedication' }
    $used = Num $ded['taken']
    foreach ($d in $db['donations']) { if ($d['status'] -eq 'paid' -and $d['dedicationId'] -eq $dedId) { $used++ } }
    if ($used -ge (Num $ded['total'])) { return Fail $res 409 'dedication-taken' }
    if ($baseIls -lt (Num $ded['amount']) - $rate * $months) { return Fail $res 400 'dedication-amount' }
  }
  $teamId = Str $b 'teamId' 40
  if ($teamId -and -not ($c['teams'] | Where-Object { $_['id'] -eq $teamId -and $_['status'] -ne 'pending' })) { $teamId = '' }

  $credited = [Math]::Round((Get-Credit $baseIls), 2)
  $now = NowMs
  $don = @{
    id = 'd' + $now + (RandHex 3); date = $now; createdAt = $now; source = 'online'; method = 'card'; status = 'paid'
    name = $name; email = $email; phone = $phone; idNumber = $idNumber
    amount = $amount; cur = $cur; months = $months; baseIls = $baseIls; credited = $credited
    teamId = $teamId; dedicationId = $dedId; dedication = (Str $b 'dedication' 120)
    plaqueStatus = $(if ($dedId) { 'new' } else { '' }); plaqueText = ''
    message = (Str $b 'message' 140); anon = [bool]$b['anon']; hideMessage = $false
    wantsReceipt = [bool]$b['receipt']; receiptSent = $false; notes = ''; demo = $false
  }
  $db['donations'] = @($db['donations']) + $don
  SaveDb
  Send $res 200 @{ ok = $true; id = $don['id'] }
}

function Api-NewTeam($req, $res) {
  $b = Read-Body $req; $c = Cfg
  $leader = Str $b 'leader' 60; $name = Str $b 'name' 80; $goal = [Math]::Floor((Num $b['goal']))
  if (-not $leader -or -not $name -or $goal -lt 1000) { return Fail $res 400 'fields' }
  $approve = (Has $c 'settings') -and [bool]$c['settings']['approveTeams']
  $tm = @{ id = 'u' + (NowMs) + (RandHex 2); name = $name; leader = $leader; goal = $goal; raised = 0; donors = 0
           status = $(if ($approve) { 'pending' } else { 'approved' }); email = (Str $b 'email' 120); createdAt = (NowMs) }
  $c['teams'] = @($c['teams']) + $tm
  SaveDb
  Send $res 200 @{ ok = $true; team = $tm }
}

# ---------- admin API ----------
function Api-Admin($req, $res, [string]$path, [string]$method) {
  if ($path -eq 'status') {
    $me = Get-SessionUser $req
    return Send $res 200 @{ ok = $true; setup = -not (Test-Path $adminPath); loggedIn = ($null -ne $me); user = $(if ($me) { Public-User $me } else { $null }) }
  }
  if ($path -eq 'setup' -and $method -eq 'POST') {
    if (Test-Path $adminPath) { return Fail $res 403 'already-setup' }
    $b = Read-Body $req
    $pw = Str $b 'password' 200
    $un = Str $b 'username' 32; if ($un -eq '') { $un = 'admin' }
    if ($un -notmatch $validUsername) { return Fail $res 400 'username' }
    if ($pw.Length -lt 8) { return Fail $res 400 'weak' }
    if ($null -eq $db) {
      if (-not (Valid-Db $b['db'])) { return Fail $res 400 'db' }
      $script:db = $b['db']; SaveDb
    }
    $u = New-PwFields $pw
    $u['id'] = 'u' + (RandHex 4); $u['username'] = $un; $u['name'] = (Str $b 'name' 60); $u['role'] = 'manager'; $u['updatedAt'] = NowMs
    $list = New-Object System.Collections.ArrayList; [void]$list.Add($u); Save-Users $list
    New-Session $res $u
    return Send $res 200 @{ ok = $true }
  }
  if ($path -eq 'login' -and $method -eq 'POST') {
    if ((NowMs) -lt $script:lockUntil) { return Fail $res 429 'locked' }
    $b = Read-Body $req
    $u = Find-User (Load-Users) (Str $b 'username' 32)
    if ($u -and (Test-UserPw $u (Str $b 'password' 200))) { $script:fails = 0; New-Session $res $u ($b['remember'] -eq $true); return Send $res 200 @{ ok = $true } }
    $script:fails++
    if ($script:fails -ge 5) { $script:lockUntil = (NowMs) + 60000; $script:fails = 0 }
    return Fail $res 401 'wrong'
  }
  $me = Get-SessionUser $req
  if (-not $me) { return Fail $res 401 'auth' }
  # viewer (authorized, read-only): may only read data, log out and change their own password
  if ($me['role'] -ne 'manager' -and $path -notin 'logout', 'password', 'data') { return Fail $res 403 'forbidden' }

  switch -regex ($path) {
    '^logout$' {
      $sessions.Remove((TokKey $req.Cookies['sid'].Value)); Save-Sessions
      $res.Headers.Add('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
      return Send $res 200 @{ ok = $true }
    }
    '^password$' {
      $b = Read-Body $req
      if (-not (Test-UserPw $me (Str $b 'current' 200))) { return Fail $res 401 'wrong' }
      $new = Str $b 'password' 200
      if ($new.Length -lt 8) { return Fail $res 400 'weak' }
      $list = Load-Users; $u = Find-User $list $me['id'] 'id'
      $f = New-PwFields $new; $u['salt'] = $f['salt']; $u['hash'] = $f['hash']; $u['updatedAt'] = NowMs
      Save-Users $list; End-UserSessions $me['id'] $req.Cookies['sid'].Value
      return Send $res 200 @{ ok = $true }
    }
    '^users$' {
      $list = Load-Users
      if ($method -eq 'GET') {
        $out = New-Object System.Collections.ArrayList
        foreach ($u in $list) { [void]$out.Add((Public-User $u)) }
        return Send $res 200 @{ ok = $true; users = $out.ToArray() }
      }
      $b = Read-Body $req
      $un = Str $b 'username' 32; $pw = Str $b 'password' 200; $role = Str $b 'role' 20
      if ($un -notmatch $validUsername) { return Fail $res 400 'username' }
      if (Find-User $list $un) { return Fail $res 409 'exists' }
      if ($role -notin 'manager', 'viewer') { return Fail $res 400 'role' }
      if ($pw.Length -lt 8) { return Fail $res 400 'weak' }
      $u = New-PwFields $pw
      $u['id'] = 'u' + (RandHex 4); $u['username'] = $un; $u['name'] = (Str $b 'name' 60); $u['role'] = $role; $u['updatedAt'] = NowMs
      [void]$list.Add($u); Save-Users $list
      return Send $res 200 @{ ok = $true; user = (Public-User $u) }
    }
    '^users/([\w-]+)$' {
      $list = Load-Users; $u = Find-User $list $Matches[1] 'id'
      if (-not $u) { return Fail $res 404 'not-found' }
      if ($method -eq 'DELETE') {
        if ($u['id'] -eq $me['id']) { return Fail $res 400 'self' }
        if ($u['role'] -eq 'manager' -and (Count-Managers $list) -le 1) { return Fail $res 400 'last-manager' }
        $list.Remove($u); Save-Users $list; End-UserSessions $u['id']
        return Send $res 200 @{ ok = $true }
      }
      $b = Read-Body $req
      if (Has $b 'role') {
        $role = Str $b 'role' 20
        if ($role -notin 'manager', 'viewer') { return Fail $res 400 'role' }
        if ($u['role'] -eq 'manager' -and $role -ne 'manager' -and (Count-Managers $list) -le 1) { return Fail $res 400 'last-manager' }
        $u['role'] = $role
      }
      if (Has $b 'name') { $u['name'] = Str $b 'name' 60 }
      if (Has $b 'password') {
        $pw = Str $b 'password' 200
        if ($pw.Length -lt 8) { return Fail $res 400 'weak' }
        $f = New-PwFields $pw; $u['salt'] = $f['salt']; $u['hash'] = $f['hash']
        End-UserSessions $u['id'] $req.Cookies['sid'].Value
      }
      $u['updatedAt'] = NowMs; Save-Users $list
      return Send $res 200 @{ ok = $true; user = (Public-User $u) }
    }
    '^data$' { return Send $res 200 @{ ok = $true; config = (Cfg); donations = @($db['donations']); now = (NowMs); status = (Get-Status) } }
    '^config$' {
      $b = Read-Body $req
      if (-not ($b['config'] -is [System.Collections.IDictionary])) { return Fail $res 400 'config' }
      $db['config'] = $b['config']; SaveDb
      return Send $res 200 @{ ok = $true }
    }
    '^donations$' {
      $b = Read-Body $req; $d = $b['donation']
      if (-not ($d -is [System.Collections.IDictionary])) { return Fail $res 400 'donation' }
      $now = NowMs
      $d['id'] = 'm' + $now + (RandHex 3); $d['createdAt'] = $now
      if (-not (Has $d 'date')) { $d['date'] = $now }
      if (-not (Has $d 'source')) { $d['source'] = 'manual' }
      $db['donations'] = @($db['donations']) + $d; SaveDb
      return Send $res 200 @{ ok = $true; donation = $d }
    }
    '^donations/([\w-]+)$' {
      $id = $Matches[1]
      $idx = -1; $arr = @($db['donations'])
      for ($i = 0; $i -lt $arr.Count; $i++) { if ($arr[$i]['id'] -eq $id) { $idx = $i; break } }
      if ($idx -lt 0) { return Fail $res 404 'not-found' }
      if ($method -eq 'DELETE') {
        $list = New-Object System.Collections.ArrayList; $list.AddRange($arr); $list.RemoveAt($idx)
        $db['donations'] = $list.ToArray(); SaveDb
        return Send $res 200 @{ ok = $true }
      }
      $patch = (Read-Body $req)['donation']
      foreach ($k in @($patch.Keys)) { if ($k -ne 'id') { $arr[$idx][$k] = $patch[$k] } }
      $arr[$idx]['updatedAt'] = NowMs
      SaveDb
      return Send $res 200 @{ ok = $true; donation = $arr[$idx] }
    }
    '^purge-demo$' {
      $keep = New-Object System.Collections.ArrayList
      foreach ($d in $db['donations']) { if (-not $d['demo']) { [void]$keep.Add($d) } }
      $db['donations'] = $keep.ToArray()
      foreach ($t in $db['config']['teams']) { if ($t['demo']) { $t['raised'] = 0; $t['donors'] = 0; $t['demo'] = $false } }
      SaveDb
      return Send $res 200 @{ ok = $true }
    }
    '^upload$' {
      $b = Read-Body $req
      $m = [regex]::Match("$($b['dataUrl'])", '^data:image/(png|jpeg|webp|gif);base64,(.+)$')
      if (-not $m.Success) { return Fail $res 400 'type' }
      $bytes = [Convert]::FromBase64String($m.Groups[2].Value)
      if ($bytes.Length -gt 8MB) { return Fail $res 413 'size' }
      $ext = $(if ($m.Groups[1].Value -eq 'jpeg') { 'jpg' } else { $m.Groups[1].Value })
      $fname = (RandHex 8) + '.' + $ext
      [IO.File]::WriteAllBytes((Join-Path $uploadDir $fname), $bytes)
      return Send $res 200 @{ ok = $true; path = "uploads/$fname" }
    }
    '^restore$' {
      $b = Read-Body $req; $n = $b['db']
      if (-not (Valid-Db $n)) { return Fail $res 400 'db' }
      WriteFileSafe "$dbPath.before-restore" ($js.Serialize($db))
      $script:db = $n; SaveDb
      return Send $res 200 @{ ok = $true }
    }
    default { return Fail $res 404 'unknown' }
  }
}

# ---------- main loop ----------
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Shir Chadash server running: http://localhost:$Port/  (admin: http://localhost:$Port/admin)"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  try {
    $path = $req.Url.AbsolutePath
    $method = $req.HttpMethod
    if ($path -like '/api/*' -and $method -ne 'GET') {
      $origin = $req.Headers['Origin']
      if ($origin -and $origin -ne "http://localhost:$Port") { Fail $res 403 'origin'; continue }
    }
    $needsDb = ($path -in '/api/public', '/api/donate', '/api/teams') -or ($path -like '/api/admin/*' -and $path -notin '/api/admin/status', '/api/admin/setup', '/api/admin/login')
    if ($needsDb -and $null -eq $db) { Fail $res 503 'not-setup' }
    elseif ($path -eq '/api/public' -and $method -eq 'GET') { Send $res 200 (Public-Data) }
    elseif ($path -eq '/api/donate' -and $method -eq 'POST') { Api-Donate $req $res }
    elseif ($path -eq '/api/teams' -and $method -eq 'POST') { Api-NewTeam $req $res }
    elseif ($path -like '/api/admin/*') { Api-Admin $req $res ($path.Substring(11)) $method }
    elseif ($path -like '/api/*') { Fail $res 404 'unknown' }
    else { Serve-Static $req $res }
  } catch {
    Write-Host "ERROR $($req.HttpMethod) $($req.Url.AbsolutePath): $_"
    try { Fail $res 500 'server' } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}
