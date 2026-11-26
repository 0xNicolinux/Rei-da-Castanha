# Rei da Castanha

Plataforma 2D de um esquilo coroado que recupera o estoque de castanhas. Renderizado em WebGL2 com visual HD-2D: pixel art com iluminação dinâmica por normal map.

## Como jogar
Abra `index.html` (funciona direto de `file://`) ou rode `python3 -m http.server` na pasta e acesse `http://localhost:8000`.

- Setas ou A/D: andar. Espaço, W ou ↑: pular (segure para ir mais alto).
- J, X ou K: golpe (no controle, X/□ ou B/◯). O terceiro golpe seguido é o Combo do Rei, com dano dobrado.
- No ar, aperte pular de novo e segure para **planar** com a cauda (fôlego curto, renova ao pousar ou pisar num bicho).
- No ar, S ou ↓ (direcional para baixo no controle, ▼ no toque) dá a **Pancada do Rei**: mergulho com onda de choque que derruba bichos e quebra caixotes por perto.
- Pisões seguidos sem tocar o chão formam uma **corrente** e rendem castanhas extras.
- Ao fim de cada fase o jogo guarda seu recorde de estrelas e tempo para aquela semente e mostra se você passou sem levar dano.
- Pise ou bata nos inimigos para derrotá-los. Parado por alguns segundos, o Rei dança. Pegue castanhas para abrir a saída; a cada 25 você ganha um coração.
- P ou Esc: pausa.
- Controle (Xbox/PlayStation): analógico ou direcional anda, A/✕ pula, Start pausa. Nos menus, direcional escolhe, A/✕ confirma e B/◯ volta.

## Fases procedurais
Cada fase é gerada a partir de uma semente (`?seed=123` na URL ou o campo na tela inicial). O gerador (`js/levelgen.js`) monta ritmos de segmentos a partir de gaps calculados com a física real do pulo, posiciona castanhas ao longo da parábola do pulo e valida a alcançabilidade com uma busca em largura antes de aceitar a fase. Cinco ambientes: amanhecer, mata fechada, entardecer, hora azul e festival sob a lua.

## Visual
- Iluminação dinâmica (8 luzes pontuais + sol) com normal maps; bloom HDR, raios de luz, névoa, tilt-shift, tonemap ACES, grading por ambiente, vinheta, grão.
- Terreno, galhos e florestas com parallax pintados proceduralmente.
- Coroa ancorada por frame à cabeça do esquilo (medida nos sprites), espelhada junto com ele.
- `?q=0..3` ajusta a qualidade; a resolução se adapta ao desempenho.

## Créditos
Veja `LICENSE-ASSETS.txt`.
