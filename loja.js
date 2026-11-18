(() => {
  const RATE = { folha: 1, brilho: 6, pedra: 15 };
  const ICON = { folha: "🍂", brilho: "✨", pedra: "🪨" };
  const NOME = { folha: ["folha", "folhas"], brilho: ["brilho", "brilhos"], pedra: ["pedra", "pedras"] };
  const MOEDAS = Object.keys(RATE);
  const START = { folha: 24, brilho: 4, pedra: 2 };

  // v = valor em folhas
  const PRODUTOS = [
    { id: "portuguesa", nome: "Castanha-portuguesa", desc: "Assada na brasa, quentinha no saco.", v: 12, img: "Chestnuts.jpg", c1: "#9a4b22", c2: "#4a2410" },
    { id: "para", nome: "Castanha-do-pará", desc: "Gigante, de árvore de 40 metros.", v: 30, img: "Brazil nuts.jpg", c1: "#6b4a2e", c2: "#2f2013" },
    { id: "caju", nome: "Castanha-de-caju", desc: "Torradinha, com sal de pedra.", v: 18, img: "Jumbo Cashew.JPG", c1: "#d9a45a", c2: "#9a6a2c" },
    { id: "avela", nome: "Avelã", desc: "Pequena, redonda e muito disputada.", v: 20, img: "Hazel nut harvest.jpg", c1: "#c58a4a", c2: "#7d4d22" },
    { id: "amendoa", nome: "Amêndoa", desc: "Crocante, ótima para guardar no inverno.", v: 16, img: "Dry Almonds.jpg", c1: "#c9a070", c2: "#7e5a34" },
    { id: "noz", nome: "Noz", desc: "Casca enrugada, miolo em formato de cérebro.", v: 24, img: "Juglans regia MHNT.BOT.2007.40.64.jpg", c1: "#b08a5a", c2: "#6a4a2a" },
    { id: "nozpreta", nome: "Noz-preta", desc: "Casca dura e sabor forte. Traga o martelo.", v: 26, img: "Black walnut cracked open to expose meat.jpg", c1: "#5a4632", c2: "#24190f" },
    { id: "peca", nome: "Noz-pecã", desc: "Doce e amanteigada, da família das hickories.", v: 38, img: "Carya nuts.jpg", c1: "#8a5a36", c2: "#47291a" },
    { id: "pistache", nome: "Pistache", desc: "A casca abre sozinha. As irmãs adoram.", v: 34, img: "Dry pista with shell.jpg", c1: "#b7b57a", c2: "#6b6a3a" },
    { id: "amendoim", nome: "Amendoim", desc: "Tecnicamente um legume, mas entra na festa.", v: 8, img: "Groundnuts.jpg", c1: "#d1a971", c2: "#8a6a3c" },
    { id: "cola", nome: "Noz-de-cola", desc: "Amarga, energética e cheia de história.", v: 14, img: "Kola-min.jpg", c1: "#a8553a", c2: "#5a2618" },
    { id: "ginkgo", nome: "Semente de ginkgo", desc: "Das árvores mais antigas do planeta.", v: 28, img: "Ginkgosamen ohne Fruchfleisch.jpg", c1: "#d8c58a", c2: "#8a7a44" },
    { id: "macadamia", nome: "Macadâmia", desc: "Casca dura. Só as irmãs sabem abrir.", v: 45, c1: "#e0c48a", c2: "#a98748" },
    { id: "baru", nome: "Baru", desc: "Do cerrado, com estalo no meio.", v: 22, c1: "#8c5a34", c2: "#4b2f1a" },
    { id: "pinhao", nome: "Pinhão", desc: "Cozido, direto da araucária.", v: 15, c1: "#7a3b2a", c2: "#3d1b12" },
    { id: "rei", nome: "Castanha do Rei", desc: "Carimbada pelo Rei da Castanha. Uma por cliente.", v: 80, img: "Maroni (30857732824).jpg", c1: "#d99a43", c2: "#8a3f1a", unica: true },
  ];

  const ACHADOS = {
    folha: ["uma folha de carvalho dourada", "folhas secas sob o banco", "um monte de folhas crocantes"],
    brilho: ["um botão dourado", "uma tampinha polida", "um pedaço de papel alumínio", "uma miçanga azul"],
    pedra: ["um seixo liso do riacho", "um quartzo leitoso", "uma pedra com listras"],
  };
  const FRASES = [
    "Negócio fechado! A irmã mais velha conferiu cada folha.",
    "A irmã mais nova mordeu o brilho para testar. Aprovado.",
    "Pesaram a pedra duas vezes. Está tudo certo.",
    "Saiu da prateleira e foi direto para a despensa.",
  ];

  const $ = (id) => document.getElementById(id);
  const plural = (n, m) => `${n} ${NOME[m][n === 1 ? 0 : 1]}`;
  const custo = (v, m) => Math.ceil(v / RATE[m]);
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (l) => l[Math.floor(Math.random() * l.length)];

  let st;
  try { st = JSON.parse(localStorage.getItem("c2i-loja")); } catch (e) { st = null; }
  if (!st || !st.bolsa) st = { bolsa: { ...START }, carrinho: {}, despensa: {} };
  const save = () => { try { localStorage.setItem("c2i-loja", JSON.stringify(st)); } catch (e) {} };

  const prod = (id) => PRODUTOS.find((p) => p.id === id);
  const totalV = () => Object.entries(st.carrinho).reduce((s, [id, q]) => s + prod(id).v * q, 0);

  function renderBolsa() {
    $("coins").innerHTML = MOEDAS.map((m) =>
      `<li><span class="ico" aria-hidden="true">${ICON[m]}</span><span class="n">${st.bolsa[m]}</span><span class="l">${NOME[m][1]}</span></li>`).join("");
    document.querySelectorAll("[data-chip]").forEach((el) => {
      el.textContent = MOEDAS.map((m) => `${ICON[m]} ${st.bolsa[m]}`).join(" · ");
    });
  }

  function renderShelf() {
    $("shelf").innerHTML = PRODUTOS.map((p) => `
      <article class="item" style="--c1:${p.c1};--c2:${p.c2}">
        ${p.img
          ? `<div class="photo"><img src="https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p.img)}?width=480" alt="${p.nome}" loading="lazy" onerror="this.parentNode.outerHTML='<div class=&quot;nut&quot; aria-hidden=&quot;true&quot;></div>'"><a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.img.replace(/ /g, "_"))}" target="_blank" rel="noopener">foto: Wikimedia Commons</a></div>`
          : `<div class="nut" aria-hidden="true"></div>`}
        <h4>${p.nome}</h4>
        <p>${p.desc}</p>
        <div class="tag" aria-label="Preço: ${MOEDAS.map((m) => plural(custo(p.v, m), m)).join(", ou ")}">
          ${MOEDAS.map((m) => `<span>${custo(p.v, m)} ${ICON[m]}</span>`).join("")}
        </div>
        <button type="button" data-add="${p.id}">Colocar na sacola</button>
      </article>`).join("");
  }

  function renderCart() {
    const ids = Object.keys(st.carrinho);
    $("cart").innerHTML = ids.length
      ? ids.map((id) => `<li><span>${prod(id).nome}</span><span class="qty">
          <button type="button" aria-label="Tirar uma unidade de ${prod(id).nome}" data-dec="${id}">−</button>
          <b>${st.carrinho[id]}</b>
          <button type="button" aria-label="Adicionar mais uma unidade de ${prod(id).nome}" data-inc="${id}">+</button></span></li>`).join("")
      : `<li class="empty">A sacola está vazia. Escolha uma castanha na prateleira.</li>`;
    const v = totalV();
    $("pay").innerHTML = v
      ? MOEDAS.map((m) => {
          const c = custo(v, m), ok = st.bolsa[m] >= c;
          return `<button type="button" data-pay="${m}" class="${ok ? "" : "short"}">Pagar com ${c} ${ICON[m]} <small>${ok ? plural(st.bolsa[m], m) + " na bolsa" : "faltam " + (c - st.bolsa[m])}</small></button>`;
        }).join("")
      : "";
  }

  function renderPantry() {
    const e = Object.entries(st.despensa);
    $("pantry").textContent = e.length ? e.map(([id, q]) => `${q}× ${prod(id).nome}`).join(" · ") : "Nada por aqui ainda.";
  }

  const renderAll = () => { renderBolsa(); renderCart(); renderPantry(); save(); };

  function add(id, d) {
    const p = prod(id);
    const atual = st.carrinho[id] || 0;
    const max = p.unica ? (st.despensa[id] ? 0 : 1) : 20;
    const novo = Math.min(max, Math.max(0, atual + d));
    if (novo === 0) delete st.carrinho[id]; else st.carrinho[id] = novo;
    if (p.unica && d > 0 && novo === atual) $("pay-msg").textContent = "A Castanha do Rei é de uma por cliente.";
    else $("pay-msg").textContent = "";
    renderAll();
  }

  let cooling = false;
  $("forage").addEventListener("click", () => {
    if (cooling) return;
    cooling = true; $("forage").disabled = true;
    setTimeout(() => { cooling = false; $("forage").disabled = false; }, 1200);
    const ganho = { folha: rnd(3, 8), brilho: Math.random() < 0.4 ? rnd(1, 2) : 0, pedra: Math.random() < 0.25 ? 1 : 0 };
    const partes = [];
    MOEDAS.forEach((m) => { if (ganho[m]) { st.bolsa[m] += ganho[m]; partes.push(`${plural(ganho[m], m)} (${pick(ACHADOS[m])})`); } });
    $("forage-msg").textContent = "Você achou " + partes.join(", ") + ".";
    renderAll();
  });

  $("shelf").addEventListener("click", (e) => { const b = e.target.closest("[data-add]"); if (b) add(b.dataset.add, 1); });
  $("cart").addEventListener("click", (e) => {
    const i = e.target.closest("[data-inc]"), d = e.target.closest("[data-dec]");
    if (i) add(i.dataset.inc, 1); if (d) add(d.dataset.dec, -1);
  });
  $("pay").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pay]"); if (!b) return;
    const m = b.dataset.pay, c = custo(totalV(), m);
    if (st.bolsa[m] < c) {
      $("pay-msg").textContent = `Faltam ${plural(c - st.bolsa[m], m)}. Cate mais na floresta ou pague com outra moeda.`;
      return;
    }
    st.bolsa[m] -= c;
    Object.entries(st.carrinho).forEach(([id, q]) => { st.despensa[id] = (st.despensa[id] || 0) + q; });
    st.carrinho = {};
    $("pay-msg").textContent = `Pago com ${plural(c, m)}. ${pick(FRASES)}`;
    renderAll();
  });
  $("reset").addEventListener("click", () => {
    st = { bolsa: { ...START }, carrinho: {}, despensa: {} };
    $("pay-msg").textContent = ""; $("forage-msg").textContent = "Bolsa reabastecida. Bom comércio!";
    renderAll();
  });

  renderShelf(); renderAll();
})();
