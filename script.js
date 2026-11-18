document.getElementById("year").textContent = new Date().getFullYear();

const audio = document.getElementById("music-player");
const status = document.getElementById("audio-status");

audio.addEventListener("error", () => {
  status.textContent = "Não foi possível carregar music.mp3. Coloque o arquivo na mesma pasta de index.html.";
});
audio.addEventListener("canplay", () => {
  status.textContent = "";
});


/* ---------- carrossel da história ---------- */
const storyScenes = [
  {
    image: "assets/historia-02-furia.jpg",
    alt: "O esquilo Rei da Castanha irritado na floresta",
    title: "A despensa foi saqueada",
    description: "“Cadê minhas castanhas?!” A fome vira indignação e a floresta sente o clima.",
  },
  {
    image: "assets/historia-03-guitarra.jpg",
    alt: "O esquilo toca guitarra com sua jaqueta de rock",
    title: "A fúria vira rock",
    description: "Guitarra ligada, amplificador no máximo e cada acorde como um trovão.",
  },
  {
    image: "assets/historia-04-show.jpg",
    alt: "O Rei da Castanha toca para os animais no palco da floresta",
    title: "O show vai começar",
    description: "A floresta inteira acompanha o som enquanto o esquilo faz seu grande show.",
  },
  {
    image: "assets/historia-01-entrega.jpg",
    alt: "Uma carreta carregada de castanhas chega à festa na floresta",
    title: "A carreta salvadora",
    description: "Castanha Duas Irmãs aparece com uma carga capaz de mudar o humor da festa.",
  },
  {
    image: "assets/historia-05-festival.jpg",
    alt: "Os esquilos formam uma banda e tocam no festival da floresta",
    title: "A floresta entra na dança",
    description: "Com a alegria de volta, os amigos sobem ao palco e a festa continua.",
  },
  {
    image: "assets/historia-06-felicidade.jpg",
    alt: "O Rei da Castanha feliz abraça uma castanha na floresta",
    title: "Castanhas para todo lado!",
    description: "A fome passou, a raiva acabou e o Rei da Castanha está no paraíso.",
  },
];

const storyImage = document.getElementById("story-image");
if (storyImage) {
  const storyTitle = document.getElementById("story-title");
  const storyDescription = document.getElementById("story-description");
  const storyCount = document.getElementById("story-count");
  const storyDots = document.getElementById("story-dots");
  const previousButton = document.getElementById("story-prev");
  const nextButton = document.getElementById("story-next");
  let currentScene = 0;

  function showScene(index) {
    currentScene = (index + storyScenes.length) % storyScenes.length;
    const scene = storyScenes[currentScene];
    storyImage.src = scene.image;
    storyImage.alt = scene.alt;
    storyTitle.textContent = scene.title;
    storyDescription.textContent = scene.description;
    storyCount.textContent = `${String(currentScene + 1).padStart(2, "0")} / ${String(storyScenes.length).padStart(2, "0")}`;
    [...storyDots.children].forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === currentScene);
      dot.setAttribute("aria-current", dotIndex === currentScene ? "true" : "false");
    });
  }

  storyScenes.forEach((scene, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel-dot";
    dot.setAttribute("aria-label", `Ir para cena ${index + 1}: ${scene.title}`);
    dot.addEventListener("click", () => showScene(index));
    storyDots.appendChild(dot);
  });

  previousButton.addEventListener("click", () => showScene(currentScene - 1));
  nextButton.addEventListener("click", () => showScene(currentScene + 1));
  showScene(0);
}
