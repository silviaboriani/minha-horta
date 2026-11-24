# Minha Horta — regras de trabalho

App de planejamento de horta (Piraquara-PR), em português, HTML/CSS/JS puro, sem etapa de build.
Publicado no GitHub Pages; a cada publicação, aumentar `VERSAO` em `sw.js`.

## Como construir

- **KISS e DRY:** preferir a menor solução completa, reutilizando o que já existe quando fizer sentido.
- **Complexidade só quando necessária** para o objetivo atual. Não criar infraestrutura para hipóteses futuras.
- **Simples não é incompleto:** não entregar pela metade, e não julgar exagero pela quantidade de arquivos ou linhas.
- **Separar lógica de tela (espírito de MVVM, SOLID e código limpo), sem reescrever o app:**
  - a regra de negócio fica em funções puras que recebem dados e devolvem dados (ex.: `gerarPlano`, `quantidadeAlvo`);
  - o desenho da tela (`render…`) só lê o resultado;
  - os eventos só chamam funções de ação (`registrar()` → muda `estado` → `mudou()`);
  - aplicar ao mexer em cada parte, não como reescrita geral.
- **Android (quando chegar a hora):** usar Material Design como base visual.

## Antes de encerrar

1. **Revisar todas as alterações** (diff completo).
2. **Revisão cega em mudanças relevantes:** um subagente independente que recebe só a história do usuário e o diff, sem o contexto da conversa. Conferir cada achado contra o código e os requisitos antes de corrigir.
3. **Testes:**
   - unitários para a lógica;
   - integrados para os fluxos: `testes/*.test.js`, rodados numa aba separada do navegador
     (instruções no topo de cada arquivo; resultado em `window.resultadoTestes`).
     Rodar todos antes de publicar e acrescentar testes para cada funcionalidade nova;
   - manual no navegador (aba separada, sem salvar, sem mexer nos dados da usuária);
   - no emulador quando houver versão Android/iPad nativa.
4. **Terminar a resposta com um resumo curto e autossuficiente:** o que foi feito, resultado, validações e pendências.

## Cuidados que já valem

- `node --check` em todo JS alterado.
- Usar `perguntar()`/`avisar()`, nunca `confirm()`/`prompt()`.
- Perguntar antes de cada push/publicação.
- Testes nunca alteram o `localStorage` real: usar `window.salvar = () => {}` e `estado = migrar(criarExemploHorta())`.
- **Horta compartilhada:** ao mexer em `js/nuvem.js` ou em `firestore.rules`, conferir se as regras ainda aceitam o que o app grava
  (campos, `versao` + 1, lista `emails`), rodar `testes/nuvem.test.js` e, se as regras mudaram, publicá-las de novo
  no console do Firebase (projeto `minha-horta-89936` → Firestore → Regras). Os dois lados mudam juntos.
