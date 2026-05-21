import { chmod, stat } from "node:fs/promises";
import { platform } from "node:os";

// ─── File Permission Hardening ────────────────────────────────────────────────

/**
 * Sets restrictive permissions on a file (chmod 600 on Unix).
 * On Windows, this is a best-effort operation using the available fs APIs.
 */
export async function secureFile(filePath: string): Promise<void> {
  if (platform() === "win32") {
    // Windows does not support POSIX chmod.
    // We do a best-effort check that the file exists and is accessible.
    // For production hardening on Windows, icacls would be needed via shell,
    // but we avoid shell execution per security requirements.
    try {
      await stat(filePath);
    } catch {
      // File doesn't exist yet, nothing to secure
    }
    return;
  }

  try {
    // 0o600 = owner read+write only
    await chmod(filePath, 0o600);
  } catch (err) {
    // Non-fatal: log a warning but don't crash
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `Uyarı: Config dosyası izinleri ayarlanamadı: ${msg}\n`,
    );
  }
}

/**
 * Verifies that a file has secure permissions (owner-only on Unix).
 * Returns true if permissions are acceptable, false otherwise.
 */
export async function checkFilePermissions(filePath: string): Promise<boolean> {
  if (platform() === "win32") {
    return true; // Cannot reliably check on Windows without shell
  }

  try {
    const stats = await stat(filePath);
    // Check that group and other have no permissions
    const mode = stats.mode & 0o777;
    return (mode & 0o077) === 0;
  } catch {
    return false;
  }
}
