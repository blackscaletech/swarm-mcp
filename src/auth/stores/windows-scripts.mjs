const CREDENTIAL_API = String.raw`
using System;
using System.Runtime.InteropServices;

public static class SwarmCredentialApi {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct Credential {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredWrite(ref Credential credential, UInt32 flags);

  [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);

  [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr credential);
}
`;

const PREAMBLE = `$ErrorActionPreference = "Stop"\nAdd-Type -TypeDefinition @'\n${CREDENTIAL_API}\n'@\n` + String.raw`
$target = [Console]::In.ReadLine()
if ([String]::IsNullOrWhiteSpace($target) -or $target.Length -gt 256) { exit 1 }
`;

export const WINDOWS_LOAD_SCRIPT = PREAMBLE + String.raw`
$pointer = [IntPtr]::Zero
if (-not [SwarmCredentialApi]::CredRead($target, 1, 0, [ref]$pointer)) {
  if ([Runtime.InteropServices.Marshal]::GetLastWin32Error() -eq 1168) { exit 0 }
  exit 1
}
try {
  $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][SwarmCredentialApi+Credential])
  if ($credential.CredentialBlobSize -gt 2400) { exit 1 }
  $bytes = New-Object byte[] $credential.CredentialBlobSize
  if ($bytes.Length -gt 0) { [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length) }
  [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))
} finally {
  [SwarmCredentialApi]::CredFree($pointer)
}
`;

export const WINDOWS_SAVE_SCRIPT = PREAMBLE + String.raw`
$value = [Console]::In.ReadToEnd()
$bytes = [Text.Encoding]::UTF8.GetBytes($value)
if ($bytes.Length -eq 0 -or $bytes.Length -gt 2400) { exit 1 }
$blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
try {
  [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
  $credential = New-Object SwarmCredentialApi+Credential
  $credential.Type = 1
  $credential.TargetName = $target
  $credential.CredentialBlobSize = $bytes.Length
  $credential.CredentialBlob = $blob
  $credential.Persist = 2
  $credential.UserName = "Swarm MCP"
  if (-not [SwarmCredentialApi]::CredWrite([ref]$credential, 0)) { exit 1 }
} finally {
  $zero = New-Object byte[] $bytes.Length
  [Runtime.InteropServices.Marshal]::Copy($zero, 0, $blob, $zero.Length)
  [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
}
`;

export const WINDOWS_REMOVE_SCRIPT = PREAMBLE + String.raw`
if (-not [SwarmCredentialApi]::CredDelete($target, 1, 0)) {
  if ([Runtime.InteropServices.Marshal]::GetLastWin32Error() -eq 1168) { exit 0 }
  exit 1
}
`;
