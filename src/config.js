/**
 * Inicialização do DuckDB WASM no navegador.
 *
 * O DuckDB oferece dois bundles de execução:
 *  - MVP (Minimum Viable Product): compatível com todos os navegadores modernos.
 *  - EH (Exception Handling): mais rápido, mas exige suporte a WebAssembly EH no browser.
 * O método `selectBundle` escolhe automaticamente o bundle mais eficiente disponível.
 */
import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

// Mapeamento manual dos bundles para que o Vite consiga resolver os arquivos .wasm como assets
const MANUAL_BUNDLES = {
  mvp: { mainModule: duckdb_wasm, mainWorker: mvp_worker },
  eh: { mainModule: duckdb_wasm_eh, mainWorker: eh_worker },
};

/**
 * Instancia e retorna um banco DuckDB pronto para uso no navegador.
 * O worker roda em uma thread separada para não bloquear a UI durante queries pesadas.
 */
export async function loadDb() {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return db;
}
