'use strict';

// =====================================================================
//  Minha Horta — Caixas de diálogo do próprio app
//  (substituem confirm()/prompt(), que alguns navegadores bloqueiam)
//
//  const ok   = await perguntar({ titulo, texto, ok: 'Apagar', perigo: true });
//  const nome = await perguntar({ titulo, texto, campo: { valor: '', placeholder: '…' } });
//  → true/false, ou o texto digitado (null se cancelar)
// =====================================================================

let respostaDialogo = null;

function perguntar({ titulo, texto = '', ok = 'OK', cancelar = 'Cancelar', perigo = false, campo = null }) {
  const box = $('dialogoCaixa');
  box.innerHTML = `
    <h3>${escapar(titulo)}</h3>
    ${texto ? `<p>${texto}</p>` : ''}
    ${campo ? `<input class="dialogo-campo" value="${escapar(campo.valor || '')}" placeholder="${escapar(campo.placeholder || '')}">` : ''}
    <div class="dialogo-botoes">
      <button data-resp="nao">${escapar(cancelar)}</button>
      <button data-resp="sim" class="${perigo ? 'perigo-cheio' : 'principal'}">${escapar(ok)}</button>
    </div>`;
  $('modalDialogo').classList.remove('oculto');
  const entrada = box.querySelector('.dialogo-campo');
  setTimeout(() => (entrada ? (entrada.focus(), entrada.select()) : box.querySelector('[data-resp="sim"]').focus()), 30);
  return new Promise(resolve => { respostaDialogo = { resolve, campo: !!campo }; });
}

function fecharDialogo(sim) {
  if (!respostaDialogo) return;
  const { resolve, campo } = respostaDialogo;
  respostaDialogo = null;
  const valor = campo ? $('dialogoCaixa').querySelector('.dialogo-campo').value : null;
  $('modalDialogo').classList.add('oculto');
  resolve(campo ? (sim ? valor : null) : sim);
}

function montarDialogo() {
  const m = $('modalDialogo');
  m.addEventListener('click', ev => {
    if (ev.target === m) { fecharDialogo(false); return; }
    const r = ev.target.closest('[data-resp]')?.dataset.resp;
    if (r) fecharDialogo(r === 'sim');
  });
  m.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); fecharDialogo(true); }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fecharDialogo(false); }
  });
}
