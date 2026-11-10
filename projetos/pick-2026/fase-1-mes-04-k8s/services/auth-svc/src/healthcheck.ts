/** Liveness local, sem inicializar banco ou servidor. */
export async function healthcheck(port: number, timeoutMs = 3000): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}
