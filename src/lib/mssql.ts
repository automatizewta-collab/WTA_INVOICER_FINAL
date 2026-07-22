// ============================================
// INVOICER - MSSQL ERP Connection Pool (singleton)
// Lazy import: mssql is only loaded when actually connecting
// ============================================

let pool: unknown = null;

export function isErpConfigured(): boolean {
  return !!(process.env.MSSQL_HOST && process.env.MSSQL_USER && process.env.MSSQL_DATABASE);
}

async function getMssql() {
  const mod = await import("mssql");
  return mod.default.ConnectionPool;
}

async function getErpPool() {
  if (!isErpConfigured()) {
    throw new Error("ERP (MSSQL) not configured. Set MSSQL_HOST, MSSQL_USER, MSSQL_PASSWORD, MSSQL_DATABASE in .env");
  }
  if (!pool) {
    const sql = await getMssql();
    pool = new (sql as unknown as new (c: unknown) => unknown)({
      server: process.env.MSSQL_HOST || "localhost",
      port: parseInt(process.env.MSSQL_PORT || "1433", 10),
      user: process.env.MSSQL_USER || "",
      password: process.env.MSSQL_PASSWORD || "",
      database: process.env.MSSQL_DATABASE || "",
      options: {
        encrypt: process.env.MSSQL_ENCRYPT === "true",
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 15000,
      },
      pool: {
        min: 0,
        max: 5,
        idleTimeoutMillis: 30000,
      },
    });
    (pool as { on: (evt: string, fn: (err: Error) => void) => void }).on("error", (err: Error) => {
      console.error("[MSSQL] Pool error:", err.message);
      pool = null;
    });
  }
  const connected = (pool as { connected: boolean }).connected;
  if (!connected) {
    await (pool as { connect: () => Promise<void> }).connect();
    console.log("[MSSQL] Connected to", process.env.MSSQL_HOST, "/", process.env.MSSQL_DATABASE);
  }
  return pool;
}

export async function queryErp<T = Record<string, unknown>>(
  sqlQuery: string,
  params?: Record<string, string | number | null>,
): Promise<T[]> {
  const pool = await getErpPool() as {
    request: () => { input: (k: string, v: unknown) => void; query: (q: string) => Promise<{ recordset: T[] }> };
  };
  const request = pool.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }
  const result = await request.query(sqlQuery);
  return result.recordset;
}

/**
 * Parse a Brazilian number string ("0,03" or "1.200,50") to float.
 */
export function parseBrNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim();
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}