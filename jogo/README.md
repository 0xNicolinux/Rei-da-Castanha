# Rei da Castanha: Pânico na Floresta

Plataforma 2D de um esquilo coroado atrás das castanhas roubadas. WebGL2, visual HD-2D: pixel art com luz dinâmica.

## Como jogar
Abra `index.html` (funciona direto de `file://`) ou rode `python3 -m http.server` na pasta.

| Ação | Teclado | Controle | Toque |
|---|---|---|---|
| Andar | ←/→ ou A/D | analógico | analógico (polegar esquerdo) |
| Pular (segure = mais alto; no ar: pulo duplo, depois planar) | Espaço | A/✕ | Pular |
| Tabefe | J, X ou K | X/□ ou B/◯ | Bater |
| Bola rolante (invulnerável, derruba bichos) | ←← ou →→ rápido, Shift ou L | RB/RT ou Y | Bola, ou toque duplo no analógico |
| Subir no cipó / mergulhar | ↑ / ↓ | direcional | analógico |
| Pancada do Rei (no ar) | S ou ↓ | ↓ | Pancada |
| Pausa | Esc ou P | Start | ❚❚ |

## As fases
São cinco, desenhadas à mão em `js/levels.js`. Cada fase traz no topo o seu plano: caminho principal, rotas opcionais, segredos e ritmo.

1. **A Toca ao Amanhecer**: ensina tudo, sem buraco mortal até o tronco seco. Persiga o urso do saco.
2. **Mata Fechada**: copas, um grande lago com jangada e uma ponte levadiça. Junte as peças da guitarra.
3. **Entardecer no Cipoal**: a fase do balanço. Solte as irmãs e fuja da gangue.
4. **Hora Azul**: acenda os lampiões e abra as pontes para o caminhão do Gambá passar.
5. **Festival Sob a Lua**: lanternas, jangadas e o duelo com o Barão Urso.

Em toda fase há **3 castanhas douradas** escondidas. Ache as três e ganhe um coração.

## Cenário interativo (`js/mechanics.js`)
- **Água:** o Rei boia, ↓ mergulha e Espaço perto da superfície salta para fora.
- **Cipó de balançar:** agarra sozinho ao encostar. ←/→ dá embalo, Espaço solta com o impulso.
- **Cipó de escalar:** ↑/↓ sobe e desce, Espaço pula.
- **Pontes:**
  - de corda: verga sob os pés.
  - levadiça: um tabefe na alavanca abaixa.
  - tronco seco: um tabefe derruba e ele vira ponte.
- **Jangadas:** levam quem está em cima.

## Créditos
Veja `LICENSE-ASSETS.txt`.
