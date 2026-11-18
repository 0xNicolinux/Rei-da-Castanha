document.getElementById("year").textContent = new Date().getFullYear();

const audio = document.getElementById("music-player");
const status = document.getElementById("audio-status");

audio.addEventListener("error", () => {
  status.textContent = "Não foi possível carregar music.mp3. Coloque o arquivo na mesma pasta de index.html.";
});
audio.addEventListener("canplay", () => {
  status.textContent = "";
});
