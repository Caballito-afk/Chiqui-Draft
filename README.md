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

## Mercado rediseñado (`js/mercado.js`, `css/15-mercado.css`, pantalla `#screen-market` de `index.html`)
- **Barra del mercado:** arriba están el selector **"Ofertar como"** (multijugador local: un botón por equipo humano, con presupuesto) y las pestañas
  **👥 Jugadores / 📬 Ofertas / 🆓 Mercado libre**. Con un solo jugador o en una sala online el selector es una etiqueta fija.
- **Notificaciones:** punto rojo con número en la pestaña Ofertas y en el botón de cada equipo (ofertas por responder + novedades sin ver),
  banner "Ver ofertas" en las otras pestañas y avisos emergentes cuando llega una oferta, te la aceptan, te la rechazan (con el motivo si fue un bot),
  la retiran o se cae. Las novedades quedan en la pestaña Ofertas ("🔔 Novedades") y se marcan como leídas al verlas.
- **Pantalla de oferta:** "Ofertar" abre una pantalla propia (objetivo, dinero con atajos, jugador a entregar y resumen). "← Volver al mercado" o "Cancelar" vuelven a la lista.
- **Arqueros:** al ofertar por un jugador de campo no aparecen arqueros para entregar; si el objetivo es un arquero, solo aparecen arqueros.
  La regla también está en `validateTrade` ("Los arqueros solo se intercambian por arqueros").
- La lista de jugadores tiene filtro por equipo y por posición. Las pujas, la música y el resto del juego no se tocaron.

## Música de fondo y audio (`js/musica.js`, `js/data/musica.js`, `audio/musica/`, `css/14-musica.css`)
- Los 27 temas suenan en orden aleatorio, uno tras otro y en bucle. Arrancan con el primer clic/toque (regla de los navegadores).
- Cartelito arriba a la derecha con **Artista - Tema**.
- El botón 🔊 abre el panel de audio: barra de **Sonidos** (botones, pujas, partidos), barra de **Música**, y ⏮ ⏯ ⏭. Los volúmenes se guardan en el navegador.
- Para agregar un tema: copiá el mp3 a `audio/musica/` y sumá una línea en `js/data/musica.js`.
- Los mp3 pesan ~100 MB en total (re-codificados a 128 kbps). Con `index.html` suelto también funcionan, siempre que la carpeta `audio/` vaya al lado.

## Diseño visual (`css/16-pulido-visual.css`, `fonts/`)
- Solo estética: no cambia HTML, JS ni mecánicas. Para volver al diseño anterior, quitá el `<link>` de `16-pulido-visual.css` en `index.html`.
- Tipografías propias, guardadas en `fonts/` (sin depender de Google): **Inter** (textos), **Jost** (titulares y cifras grandes) y **JetBrains Mono** (etiquetas y códigos). Los estilos visuales viven en `css/16-pulido-visual.css` y `css/17-referencia-nike.css`.
- Fondo "estadio de noche" (franjas de corte, reflector y grano), botones con respuesta al toque y cartel de música abajo a la izquierda.

## V8 · Entrada y tablas
- **Descripciones:** se sacaron los textos explicativos del inicio, del multijugador (nombre, unirse, crear, modos), del Anotador, de la barra lateral y de las cabeceras de Ajustes/Subasta/Liga. Quedan los que explican reglas.
- **Botones de entrada (`css/19-entrada-caldera.css`, `js/entrada-caldera.js`):** capa con la referencia Caldera (brasa #fc5000, píldoras, trama de puntos). Tarjetas grandes con entrada escalonada, relleno que entra al pasar el mouse, flecha que gira, onda al tocar y hundimiento al presionar; campos de nombre y código con anillo de brasa y temblor si hay error; botón primario con brillo y flecha. Todo respeta `prefers-reduced-motion`.
- **Tablas animadas (`js/animacion-tablas.js`):** la animación del modo local (filas que suben y bajan, zona que cambia de color, puntos que saltan, ▲/▼) ahora también está en los grupos de Champions del modo local y en la pantalla espejada de los invitados del multijugador. El Anotador ya la tenía.

## V9 · Configuración de partida y puja
- **Configuración (`css/20-configuracion.css`, `js/configuracion-ui.js`):** la pantalla de Configurar partida (Local, Multijugador y sala online) y la del Anotador pasan a una lista numerada de filas: nombre del ajuste a la izquierda y opciones en píldoras a la derecha. Cada opción ya no lleva texto debajo: la explicación aparece una sola vez, bajo la opción elegida. Abajo queda fija una barra con el resumen de lo elegido y el botón de empezar. En el celular los nombres pasan arriba de las opciones y la barra queda al final de la página.
- **Puja:** los equipos vuelven a mostrarse uno al lado del otro (columnas de 300 px como antes) y los renglones son compactos, con más lugar para el nombre.
- No se cambiaron ids ni lógica: los textos de las opciones se leen del HTML existente.

## V10 · Playoffs, Anotador y personalización
- **Líneas del cuadro (`js/llaves-lineas.js`, `css/21-llaves.css`):** ahora se trazan midiendo la posición real de cada tarjeta, así que coinciden aunque un cruce sea más alto que otro (antes cada tarjeta dibujaba su pedazo con CSS y se desalineaban). Cruce decidido = línea llena con punto de salida y animación de dibujo; pendiente = punteada. En el multijugador cada invitado las dibuja con sus propias medidas.
- **Anotador:** el cuadro usa la misma grilla que el modo local (cada cruce queda centrado entre los dos que lo alimentan) y lleva las mismas líneas.
- **Color del club (`js/colores-equipos.js`, `css/22-colores.css`):** tocá el número de un equipo para elegir su color (24 colores o uno propio, ajustado a un rango legible). Disponible en Local, en la sala del Multijugador (cada jugador elige el suyo; el servidor evita repetidos) y en el Anotador, que además ahora muestra el color de cada club en partidos, tabla y cruces. Los colores se recuerdan en el dispositivo.
- **Servidor:** `server.js` tiene el evento nuevo `set_color` y guarda el color de cada jugador; hay que volver a desplegarlo en Render para que el color funcione online.

## V11 · Engranaje y detalles
- **Engranaje de ajustes (`css/23-ajustes-rapidos.css`):** el botón de tema y el de audio se unieron en un solo engranaje abajo a la derecha. Su panel tiene el modo claro/oscuro, los volúmenes de efectos y música, el tema que suena y los controles anterior/pausa/siguiente. Al estar fuera de la app también lo ven los invitados online (se quitó el botón de tema aparte del invitado).
- **Local:** se sacó el brillo pulsante de la flecha del primer botón del inicio.
- **Puja libre:** el botón de plantarse vuelve a ser la mano ✋ (con el número de pases que quedan cuando hay límite), que ocupa menos lugar.

## V12 · Club completo, escudos y zonas
- **Club (`js/colores-equipos.js`, `css/22-colores.css`):** el número de cada equipo abre un editor con color principal, color secundario (mitad del punto de color), estadio y, solo en Multijugador, escudo PNG. Local: color 1, color 2 y estadio. Anotador: color 1 y color 2. Si no se escribe estadio se usa «Nombre del equipo's Stadium» (se muestra en los partidos de local).
- **Multijugador:** el editor aparece directo en el paso del nombre del club (nombre + colores + estadio + escudo juntos, con vista previa) y también se puede reabrir desde el número propio en la sala de espera. El escudo se reduce a un PNG chico y se muestra en tablas, listas y partidos; el HTML copiado a los invitados solo lleva `data-crest`, así que no pesa más.
- **Servidor:** `server.js` guarda color 2, estadio y escudo de cada jugador (evento nuevo `set_club`). Hay que volver a desplegarlo en Render.
- **Playoffs:** si el cuadro se vuelve a dibujar mientras una línea se está trazando, la animación continúa (antes se cortaba, sobre todo en las líneas que suben).
- **Zonas de las tablas (`css/24-zonas.css`):** en modo claro los colores de zona clasificada, ya clasificado, mejor tercero y eliminado se veían casi blancos; ahora tienen relleno y franja marcados.
- **Anotador:** la tabla marca zona de clasificación, ya clasificado, eliminado, mejor tercero y campeón/descenso con las mismas reglas del modo local, y cada club muestra su color.

## V13 · Escudos propios, clubes de fábrica y elegir tu equipo
- **Escudo sin subir archivos (`js/colores-equipos.js`):** en el editor del club (Multijugador) se puede armar el escudo con forma (escudo, redondo, rombo, hexágono, banderín, cuadrado), diseño (liso, mitades, franjas, banda, diagonal) y símbolo (inicial, estrella, rayo, corona, balón). Usa el color principal y el secundario del club, se redibuja solo si cambian y viaja como un PNG chico por el mismo camino que uno subido, así que el servidor no cambia. Subir un PNG sigue disponible.
- **Clubes de fábrica:** los 16 equipos por defecto (Boca, River, Independiente, Racing, San Lorenzo, Estudiantes, Vélez, Rosario Central, Newell's, Talleres, Belgrano, Lanús, Argentinos, Huracán, Defensa y Justicia, Gimnasia) vienen con su estadio y sus colores. Lo que el usuario cambie manda sobre eso, y si renombra un equipo a uno de esos nombres también toma sus datos.
- **Elegir tu equipo:** en «un jugador con bots», tocar «CPU» en otro equipo hace que sea el tuyo (el anterior pasa a CPU). Ya no tenés que ser el equipo 1.
- El nombre del estadio admite hasta 60 letras (también en `server.js`).

## V14
- Nombres de estadio de los 16 clubes de fábrica actualizados a los cortos (La Bombonera, El Monumental, Libertadores de América, El Cilindro, Nuevo Gasómetro, UNO, José Amalfitani, Gigante de Arroyito, El Coloso del Parque, Mario Alberto Kempes, Gigante de Alberdi, La Fortaleza, Diego Armando Maradona, Tomás Adolfo Ducó, Norberto Tomaghello, El Bosque).

## V15 · Bots en el multijugador local y botones de nombres
- **Bots en Multijugador local:** nueva tarjeta «Equipos con bots» en los ajustes (0 hasta cantidad − 1) y, en cada equipo, un botón JUGADOR/CPU para elegir cuáles maneja el juego. Siempre queda al menos una persona. Los bots pujan y se plantan solos en la puja libre (`freeBotTick` en `js/subasta.js`), compran en El Reloj y juegan el mercado (ofertas y respuestas); aparece la dificultad de los bots cuando hay alguno.
- **Nombres:** debajo de la lista, «Borrar todos los nombres» (los deja vacíos; si quedan vacíos se usa el nombre original) y «Restaurar nombres, colores y estadios» (vuelve nombres, colores y estadios de cada club a los de fábrica). En el Anotador hay un «Borrar nombres» junto a «Mezclar orden».

## V17
- **Inicio en modo claro:** la foto detrás del título tenía 16 % de opacidad, el borde difuminado en casi todo su ancho y una sombra negra grande en el título, lo que se veía como niebla. Ahora la foto está al 62 %, el difuminado queda solo en la orilla y el título lleva un resplandor claro corto (`css/19-entrada-caldera.css`). El modo oscuro no cambia.

## V18 · Escudos en todo el multijugador
- El escudo del club (PNG subido o armado en el juego) reemplaza al color en: tablas, listas de equipos, puja (cada renglón), botones de El Reloj, mercado, plantillas, XI ideal, cruces de playoffs, festejo del campeón y **partidos en vivo** (grande junto al marcador y chico en cada jugada del relato). Los clubes sin escudo siguen mostrando su color.
- Helpers nuevos en `js/colores-equipos.js`: `chiquiCrestHtml(t, tamaño)` y `chiquiCrestAttr(t)`. Los tamaños (`xs`, `sm`, `md`, `lg`, `xl`) están en `css/22-colores.css`.
