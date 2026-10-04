# Chiqui Draft

Abrí `index.html` en el navegador (funciona con doble clic, sin servidor).

## Estructura
- `index.html` — solo el HTML de las pantallas y la carga ordenada de CSS y JS.
- `css/` — estilos en el mismo orden de cascada que tenía el archivo original (01 → 10).
- `js/data/players.js` — base de jugadores, países y clubes.
- `js/` — un módulo por tema: ajustes, subasta, reloj, mercado, liga, modo automático, eliminatoria,
  simulación de partido, partidos en vivo, festejo, plantillas, tarjetas, XI ideal, guardado, sonidos.
- `js/inicio.js` — arranque (primer render). Carga al final, antes de `sonidos.js`.

**El orden de los `<script>` en `index.html` importa:** todos comparten el mismo ámbito global, igual que antes.

## Tarjetas y suspensiones (`js/tarjetas.js`)
- `CARD_YELLOW_AVG` — amarillas promedio por equipo y partido (0.7; antes 1.5).
- `CARD_RED_CHANCE` — chance de roja directa por equipo y partido (0.015; antes 0.05).
- `suspensionsOn()` — las suspensiones solo existen en la fase eliminatoria. En liga / grupos no hay suspendidos
  ni acumulación de amarillas, y la disciplina se reinicia en cada torneo nuevo y al empezar la eliminatoria.

## Multijugador online (`js/multijugador.js`, `server.js`, `css/12-multijugador.css`)
Menú de inicio → **Multijugador** → nombre del club → **Unirte a una sala** / **Crear una sala**.
- **Crear:** se elige el modo (Puja, Aleatorio o El Reloj), se configura igual que en el multijugador local y se fija el
  mínimo y el máximo de equipos (mín. 2, máx. 16). Se genera un código de 6 caracteres que no se repite con salas activas.
- **Unirte:** se escribe el código y se entra a la sala de espera. El anfitrión empieza cuando hay al menos el mínimo.
- **Cómo funciona:** el anfitrión corre el juego (modo "local" con todos los equipos humanos). Los invitados reciben una copia
  en vivo de su pantalla y mandan sus acciones; el anfitrión solo acepta las de su propio equipo. Cada uno ve apagados los
  controles de los demás. Avanzar fases, simular jornadas, reiniciar y volver al menú son solo del anfitrión.
- **Conexión:** WebSocket en tiempo real con Socket.io mediante un servidor Node.js (`server.js`).
  - **En local:** ejecutá `node server.js` y abrí `http://localhost:3000`.
  - **En la nube (Render.com, gratuito):** el repositorio incluye `render.yaml`. Podés conectar tu repositorio en Render como Web Service y se desplegará automáticamente. Render sirve tanto la web como el servidor de salas.
  - **Si usás GitHub Pages:** GitHub Pages solo hospeda archivos estáticos y no puede ejecutar `server.js`. Para jugar online desde GitHub Pages, desplegá `server.js` en Render (u otro host) y configurá esa URL en la web tocando el botón **⚙️ Servidor** en el menú multijugador.
- En una sala online ya no hay "Reiniciar partida": queda un solo botón **🏠 Volver al inicio** (en el chip de la sala, siempre visible). El anfitrión cierra la sala para todos; cada invitado sale solo él. Siempre te lleva al principio de la página.
- En El Reloj, cada jugador ficha con **Espacio** (o tocando su botón).
- Límites conocidos: si el anfitrión cierra la pestaña, la sala se cae; el mercado es una pantalla compartida (opera "como"
  el último que tocó algo); no hay sonidos ni confeti en los invitados; "Ver plantillas" solo está en el anfitrión.

## Cambios recientes
- **Tabla de posiciones (online):** el botón 📊 Tabla ahora lo pueden usar los invitados. Cada uno la oculta/muestra solo para sí; si el anfitrión la oculta o la muestra, se aplica a todos.
- **Multijugador online:** "Todos pasan" no aparece en una sala online. Los menús de unirse/crear y de elegir modo usan el mismo diseño
  del inicio (botones a la izquierda, título a la derecha).
- **Cartel de eliminado (online):** cada club que queda afuera (cae en eliminatorias, no clasifica a la fase eliminatoria o desciende en Liga)
  ve su cartel. Se cierra solo cuando empieza el siguiente partido/ronda, o con "Seguir viendo el torneo". El anfitrión lo calcula y lo manda
  dentro de la pantalla en un nodo oculto (`#onlElimData`); la sala y la sincronización siguen funcionando igual.
- **Aleatorio + Sin mercado:** no se muestra el presupuesto inicial.
- **Celulares:** `css/13-movil.css` agranda botones y campos en pantallas angostas/táctiles. Se corrigió que los clics del invitado no llegaban
  al botón correcto del anfitrión (`onlResolvePath` en `js/multijugador.js`).
- **Mi plantilla (online):** cada jugador de la sala tiene un botón "👥 Mi plantilla" (puja, El Reloj, sorteo, mercado, liga y eliminatorias) que abre
  solo su plantel, igual que en el modo de un jugador (formaciones y fichas arrastrables). El anfitrión usa la ventana de siempre; a los invitados el
  anfitrión les manda los planteles dentro de la pantalla (nodo oculto `#onlSquadData`) y la ventana se arma en su propio dispositivo,
  sin pasar por la pantalla compartida ni mostrarse a los demás.

## Música de fondo y audio (`js/musica.js`, `js/data/musica.js`, `audio/musica/`, `css/14-musica.css`)
- Los 27 temas suenan en orden aleatorio, uno tras otro y en bucle. Arrancan con el primer clic/toque (regla de los navegadores).
- Cartelito arriba a la derecha con **Artista - Tema**.
- El botón 🔊 abre el panel de audio: barra de **Sonidos** (botones, pujas, partidos), barra de **Música**, y ⏮ ⏯ ⏭. Los volúmenes se guardan en el navegador.
- Para agregar un tema: copiá el mp3 a `audio/musica/` y sumá una línea en `js/data/musica.js`.
- Los mp3 pesan ~100 MB en total (re-codificados a 128 kbps). Con `index.html` suelto también funcionan, siempre que la carpeta `audio/` vaya al lado.
