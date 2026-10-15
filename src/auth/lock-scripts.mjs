import { WINDOWS_CREDENTIAL_API } from "./stores/windows-scripts.mjs";

// The broker owns the kernel lock and executes store commands before reading EOF.
// A per-command supervisor retains the descriptor even if a store utility
// closes inherited descriptors or the broker is killed.
export const UNIX_LOCK_SCRIPT = String.raw`
use strict;
use warnings;
use Fcntl qw(:DEFAULT :flock F_SETFD);
use JSON::PP;
use IPC::Open3;
use IO::Select;
use Symbol qw(gensym);
use Time::HiRes qw(time);
use POSIX qw(WNOHANG);
$| = 1;
umask 0077;
my $path = shift @ARGV;
sysopen(my $lock, $path, O_CREAT | O_RDWR | O_NOFOLLOW, 0600) or exit 1;
my @st = stat($lock);
exit 1 unless @st && $st[4] == $< && ($st[2] & 0777) == 0600 && -f $lock;
fcntl($lock, F_SETFD, 0) or exit 1;
$^F = fileno($lock);
flock($lock, LOCK_EX) or exit 1;
print qq({"ready":true}\n);
while (my $line = <STDIN>) {
  my $request = eval { decode_json($line) };
  last unless $request && ref($request->{args}) eq 'ARRAY';
  my $worker = fork();
  if (!defined $worker) { print qq({"failed":true}\n); next; }
  if ($worker) {
    waitpid($worker, 0);
    if ($? != 0) { print qq({"failed":true}\n); }
    next;
  }
  close(STDIN);
  my ($in, $out, $err) = (gensym, gensym, gensym);
  my $pid = eval { open3($in, $out, $err, $request->{command}, @{$request->{args}}) };
  if (!$pid) { print qq({"unavailable":true}\n); exit 0; }
  my $input = $request->{input} // '';
  my $ok = eval { local $SIG{PIPE} = 'IGNORE'; print $in $input; close($in); 1 };
  my $select = IO::Select->new($out, $err);
  my $stdout = '';
  my $bytes = 0;
  my $deadline = time() + 10;
  while ($ok && $select->count) {
    if (time() > $deadline) { $ok = 0; last; }
    for my $fh ($select->can_read(0.05)) {
      my $n = sysread($fh, my $chunk, 4096);
      if (!$n) { $select->remove($fh); next; }
      $bytes += $n;
      if ($bytes > 32768) { $ok = 0; last; }
      $stdout .= $chunk if fileno($fh) == fileno($out);
    }
  }
  while ($ok && waitpid($pid, WNOHANG) == 0) {
    if (time() > $deadline) { $ok = 0; last; }
    select(undef, undef, undef, 0.05);
  }
  if (!$ok) { kill 9, $pid; waitpid($pid, 0); }
  my $code = ($? & 127) ? 128 + ($? & 127) : $? >> 8;
  close($out); close($err);
  print encode_json($ok ? {code => $code, stdout => $stdout} : {failed => JSON::PP::true}), "\n";
  exit 0;
}
`;

// Credential Manager calls run synchronously inside the mutex-owning process.
// No detached PowerShell store writer can outlive the mutex owner.
export const WINDOWS_LOCK_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
` + WINDOWS_CREDENTIAL_API + String.raw`
'@
$account = [Console]::In.ReadLine()
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex = New-Object Threading.Mutex($false, ('Global\SwarmMCP-' + $sid + '-' + $account))
$owned = $false
try {
  try { $owned = $mutex.WaitOne(120000) } catch [Threading.AbandonedMutexException] { $owned = $true }
  if (-not $owned) { exit 1 }
  [Console]::Out.WriteLine('{"ready":true}')
  while ($null -ne ($line = [Console]::In.ReadLine())) {
    try {
      $request = $line | ConvertFrom-Json
      $target, $value = ([string]$request.input) -split "\n", 2
      if (-not $target.StartsWith('Swarm MCP:' + $account) -or $target.Length -gt 256) { throw 'invalid' }
      $script = [string]$request.args[-1]
      $output = ''
      if ($script.Contains('CredRead($target')) {
        $pointer = [IntPtr]::Zero
        if ([SwarmCredentialApi]::CredRead($target, 1, 0, [ref]$pointer)) {
          try {
            $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][SwarmCredentialApi+Credential])
            if ($credential.CredentialBlobSize -gt 2400) { throw 'invalid' }
            $bytes = New-Object byte[] $credential.CredentialBlobSize
            if ($bytes.Length) { [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length) }
            $output = [Text.Encoding]::UTF8.GetString($bytes)
          } finally { [SwarmCredentialApi]::CredFree($pointer) }
        } elseif ([Runtime.InteropServices.Marshal]::GetLastWin32Error() -ne 1168) { throw 'failed' }
      } elseif ($script.Contains('CredWrite([ref]')) {
        $bytes = [Text.Encoding]::UTF8.GetBytes($value)
        if (-not $bytes.Length -or $bytes.Length -gt 2400) { throw 'invalid' }
        $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
        try {
          [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
          $credential = New-Object SwarmCredentialApi+Credential
          $credential.Type = 1; $credential.TargetName = $target; $credential.CredentialBlobSize = $bytes.Length
          $credential.CredentialBlob = $blob; $credential.Persist = 2; $credential.UserName = 'Swarm MCP'
          if (-not [SwarmCredentialApi]::CredWrite([ref]$credential, 0)) { throw 'failed' }
        } finally {
          [Runtime.InteropServices.Marshal]::Copy((New-Object byte[] $bytes.Length), 0, $blob, $bytes.Length)
          [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
        }
      } elseif ($script.Contains('CredDelete($target')) {
        if (-not [SwarmCredentialApi]::CredDelete($target, 1, 0) -and
            [Runtime.InteropServices.Marshal]::GetLastWin32Error() -ne 1168) { throw 'failed' }
      } else { throw 'invalid' }
      [Console]::Out.WriteLine((@{code=0; stdout=$output} | ConvertTo-Json -Compress))
    } catch { [Console]::Out.WriteLine('{"failed":true}') }
  }
} finally {
  if ($owned) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
`;
