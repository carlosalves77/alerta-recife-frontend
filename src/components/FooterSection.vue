<template>
  <footer class="footer" id="contato">
    <div class="footer-inner">
      <div class="footer-brand">
        <span>🌊</span>
        Alerta Recife
      </div>

      <ul class="footer-links">
        <li><a href="#inicio">Início</a></li>
        <li><a href="#mapa">Mapa</a></li>
        <li><a href="#sobre">Sobre</a></li>
        <li><a href="https://www.mapbox.com/" target="_blank" rel="noopener">Mapbox</a></li>
      </ul>

      <div class="footer-copy">
        © {{ new Date().getFullYear() }} Alerta Recife. Feito com 💙 para a comunidade Recifense.
        Mapa fornecido por <a href="https://www.mapbox.com/" target="_blank" rel="noopener">Mapbox</a>.
      </div>
    </div>
  </footer>
</template>
