import type { Page } from '@playwright/test'

/**
 * Modo acompanhamento — opt-in, só para você assistir a execução.
 *
 *   ACOMPANHAR=1 CLIENTE=acme SISTEMA=crm npm test    → headed + slowMo 400ms + cursor
 *   ACOMPANHAR=800 ... npm test                        → mesma coisa, 800ms por ação
 *
 * NUNCA ligue isso no run que gera a evidência oficial em hmlg:
 * o slowMo altera o timing (pode mascarar race condition) e o cursor falso
 * aparece nos screenshots e no vídeo.
 */

const bruto = (process.env.ACOMPANHAR ?? '').trim().toLowerCase()

const LIGADO = bruto !== '' && bruto !== '0' && bruto !== 'false' && bruto !== 'nao' && bruto !== 'não'

/** Milissegundos entre cada ação. Aceita `ACOMPANHAR=<ms>` para ajustar o ritmo. */
const SLOW_MO_PADRAO = 400
const slowMoInformado = Number(bruto)

export const ACOMPANHAR = LIGADO
export const SLOW_MO = Number.isFinite(slowMoInformado) && slowMoInformado > 1 ? slowMoInformado : SLOW_MO_PADRAO

/**
 * Opções de `use` do Playwright. Espalhe no config:
 *   use: { ...opcoesAcompanhar }
 * Desligado, devolve `{}` e não altera nada da configuração normal.
 */
export const opcoesAcompanhar = ACOMPANHAR
  ? { headless: false, launchOptions: { slowMo: SLOW_MO } }
  : {}

/** Uma linha no console para você não confundir um run lento com travamento. */
export function avisarAcompanhamento() {
  if (!ACOMPANHAR) return
  console.log(
    `[acompanhar] headed + slowMo ${SLOW_MO}ms + cursor visível. ` +
      `Modo de observação — NÃO use para evidência oficial.`,
  )
}

/**
 * Cursor falso: o Playwright move um mouse virtual via CDP, então o ponteiro
 * real do Windows não anda e o navegador não desenha nada. Este script escuta
 * os eventos de mouse (que são reais e confiáveis) e desenha um ponteiro por
 * cima da página.
 *
 * Só desenha — não intercepta evento, não muda layout, não mexe no DOM da
 * aplicação. Tudo é `position: fixed` + `pointer-events: none`.
 */
/**
 * O script vai como STRING, não como função.
 *
 * `addInitScript(fn)` serializa a função já transpilada — e o esbuild (tsx) injeta
 * helpers de keepNames (`__name`) que não existem dentro do navegador, derrubando
 * o script com "__name is not defined". String passa intacta por qualquer loader.
 */
const SCRIPT_CURSOR = `
(() => {
  var ID = '__qa_cursor__';

  function montar() {
    if (document.getElementById(ID)) return;
    if (!document.body || !document.head) return;

    var estilo = document.createElement('style');
    estilo.textContent = [
      '#__qa_cursor__ {',
      '  position: fixed; top: 0; left: 0;',
      '  width: 22px; height: 22px; margin: -11px 0 0 -11px;',
      '  border: 2px solid rgba(255,82,82,.95); border-radius: 50%;',
      '  background: rgba(255,82,82,.28);',
      '  box-shadow: 0 0 0 1px rgba(255,255,255,.9), 0 2px 8px rgba(0,0,0,.35);',
      '  pointer-events: none; z-index: 2147483647; will-change: transform;',
      '}',
      '#__qa_cursor__.__clicando__ { background: rgba(255,82,82,.8); }',
      '.__qa_onda__ {',
      '  position: fixed; width: 12px; height: 12px; margin: -6px 0 0 -6px;',
      '  border: 2px solid rgba(255,82,82,.9); border-radius: 50%;',
      '  pointer-events: none; z-index: 2147483646;',
      '  animation: __qa_onda_anim__ .5s ease-out forwards;',
      '}',
      '@keyframes __qa_onda_anim__ {',
      '  to { width: 56px; height: 56px; margin: -28px 0 0 -28px; opacity: 0; }',
      '}'
    ].join(' ');
    document.head.appendChild(estilo);

    var cursor = document.createElement('div');
    cursor.id = ID;
    document.body.appendChild(cursor);

    // Um único write inline concentra posição E escala: se fossem dois
    // (transform inline + scale por classe), o mousemove apagaria o clique.
    var x = -100, y = -100, escala = 1;
    function desenhar() {
      cursor.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + escala + ')';
    }
    desenhar();

    addEventListener('mousemove', function (e) {
      x = e.clientX; y = e.clientY; desenhar();
    }, { capture: true, passive: true });

    addEventListener('mousedown', function (e) {
      x = e.clientX; y = e.clientY; escala = 0.55;
      cursor.classList.add('__clicando__');
      desenhar();
      var onda = document.createElement('div');
      onda.className = '__qa_onda__';
      onda.style.left = e.clientX + 'px';
      onda.style.top = e.clientY + 'px';
      document.body.appendChild(onda);
      setTimeout(function () { onda.remove(); }, 520);
    }, { capture: true, passive: true });

    addEventListener('mouseup', function () {
      escala = 1;
      cursor.classList.remove('__clicando__');
      desenhar();
    }, { capture: true, passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }
})();
`

/**
 * Cursor falso: o Playwright move um mouse virtual via CDP, então o ponteiro real
 * do Windows não anda e o navegador não desenha nada. Este script escuta os
 * eventos de mouse (que são reais e confiáveis) e desenha um ponteiro por cima.
 *
 * Só desenha — não intercepta evento, não muda layout, não toca no DOM da
 * aplicação: tudo é `position: fixed` + `pointer-events: none`.
 */
export async function injetarCursor(page: Page) {
  await page.addInitScript({ content: SCRIPT_CURSOR })
}
