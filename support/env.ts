/**
 * Fachada de ambiente.
 *
 * Toda a resolução de cliente/sistema/ambiente/credencial vive em
 * support/clientes.ts. Este arquivo existe para os specs e o config
 * importarem de um lugar só.
 *
 *   CLIENTE=acme SISTEMA=crm AMBIENTE=hmlg npx playwright test
 */
export {
  AMBIENTE,
  CLIENTE_ID,
  SISTEMA_ID,
  sistema,
  alvo,
  baseURL,
  apiURL,
  catalogo,
  clienteIdDe,
  resolverSistema,
  idsDeClientes,
  idsDeSistemas,
  todosOsSistemas,
  credenciaisDe,
  nomesDasVariaveis,
  arquivoAuth,
  filialAlvo,
  repoDe,
  evidenciaNaoOficial,
  validarSelecao,
  resumoExecucao,
} from './clientes'

export type { Ambiente, Sistema, Credencial, AmbienteSistema } from './clientes'
