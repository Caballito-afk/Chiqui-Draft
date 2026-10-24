# Chiqui Draft

Juego de fútbol por turnos que se juega en el navegador. Armás tu plantel (en una subasta a ciegas, con un reloj que baja el precio o por sorteo), negociás pases con los demás equipos y después jugás un torneo completo: liga, copa, Champions/Libertadores o una combinación. Se puede jugar solo contra bots, entre amigos en la misma pantalla o online en una sala.

**Link para jugar:** https://chiqui-draft.onrender.com

---

## Índice

1. [Cómo ejecutarlo](#1-cómo-ejecutarlo)
2. [Flujo general de una partida](#2-flujo-general-de-una-partida)
3. [Menú de inicio](#3-menú-de-inicio)
4. [Jugadores y valores](#4-jugadores-y-valores)
5. [Pantalla de Ajustes](#5-pantalla-de-ajustes)
6. [Formas de armar los planteles](#6-formas-de-armar-los-planteles)
7. [Mercado de pases](#7-mercado-de-pases)
8. [Sorteo](#8-sorteo)
9. [Fase de liga y fase de grupos](#9-fase-de-liga-y-fase-de-grupos)
10. [Fase eliminatoria y Copa](#10-fase-eliminatoria-y-copa)
11. [Cómo se simulan los partidos](#11-cómo-se-simulan-los-partidos)
12. [Tarjetas, suspensiones y VAR](#12-tarjetas-suspensiones-y-var)
13. [Estadísticas, premios y XI ideal](#13-estadísticas-premios-y-xi-ideal)
14. [Plantillas y equilibrio del plantel](#14-plantillas-y-equilibrio-del-plantel)
15. [Personalización de clubes](#15-personalización-de-clubes)
16. [Jugadores propios y modo Predio](#16-jugadores-propios-y-modo-predio)
17. [Multijugador online](#17-multijugador-online)
18. [Anotador](#18-anotador)
19. [Sonido, música y apariencia](#19-sonido-música-y-apariencia)
20. [Guardado automático](#20-guardado-automático)
21. [Estructura del proyecto](#21-estructura-del-proyecto)
22. [Servidor](#22-servidor)

---

## 1. Cómo ejecutarlo

| Quiero… | Qué hacer |
|---|---|
| Jugar solo o con amigos en la misma pantalla | Abrir `index.html` con doble clic. No necesita servidor. |
| Jugar online en mi computadora | `npm install` y después `npm start` (o `node server.js`). Abrir `http://localhost:3000`. |
| Publicarlo | Conectar el repositorio en Render.com como *Web Service*. El archivo `render.yaml` ya trae la configuración. Render sirve la web y el servidor de salas. |
| Usar GitHub Pages | Pages solo aloja archivos estáticos, así que el servidor (`server.js`) tiene que estar desplegado en otro lado (por ejemplo Render). En el menú Multijugador, el botón **Servidor** permite escribir esa URL. |

Con `index.html` suelto el multijugador online no funciona (necesita el servidor); todo lo demás sí. La carpeta `audio/` tiene que quedar al lado de `index.html` para que suene la música.

Pruebas del almacenamiento del servidor: `npm test`.

---

## 2. Flujo general de una partida

La barra lateral izquierda muestra los pasos de la partida y marca el actual:

1. **Ajustes** — se elige formato, competencia, reglas y equipos.
2. **Fichajes y mercado de pases** — se arman los planteles (Puja, Aleatorio, El Reloj o, en Predio local, Custom) y, si se activó, se abre el mercado de pases.
3. **Liga** — fase de liga o de grupos. No aparece en la Copa.
4. **Eliminatoria** — fase eliminatoria. Se llama **Copa** cuando la competencia es Copa. No aparece en la Liga.

En Copa y Champions hay una pantalla de **Sorteo** animada antes de arrancar. Al terminar el torneo aparece el festejo del campeón, los premios individuales y el XI ideal.

En casi todas las pantallas hay **Volver al menú** y **Reiniciar partida**, con cuadro de confirmación.

---

## 3. Menú de inicio

Tres entradas:

- **Local** — se juega en este dispositivo. Primero se elige el tipo de jugadores y después el modo:
  1. **Normal** (los jugadores de siempre) o **Predio** (solo jugadores creados: los creás antes de empezar o usás los que ya tenías guardados, ver [sección 16](#16-jugadores-propios-y-modo-predio)).
  2. **Puja**, **Aleatorio** o **El Reloj**; en **Predio** aparece además **Custom** (ver [sección 16](#16-jugadores-propios-y-modo-predio)), que va directo a Ajustes.
  3. **Un Jugador (con bots)** o **Multijugador Local** (varias personas en la misma pantalla, sin bots). Custom siempre es multijugador local.
- **Multijugador** — salas online (ver [sección 17](#17-multijugador-online)).
- **Anotador** — carga de resultados a mano, sin simulación (ver [sección 18](#18-anotador)).

Los botones **← Volver** llevan un paso atrás conservando lo elegido. En Ajustes, **← Cambiar modo** vuelve a elegir Puja / Aleatorio / El Reloj (o Custom).

### Un jugador vs. multijugador local

| | Un Jugador (con bots) | Multijugador Local |
|---|---|---|
| Quién maneja los equipos | Vos manejás uno (marcado **TÚ**); el resto son bots. Podés cambiar cuál es el tuyo tocando **CPU** en otro equipo. | Cada equipo lo maneja una persona. No hay bots. |
| Puja | Por turnos contra bots | Libre, sin turnos |
| Dificultad de bots | Sí | No aplica |
| Botón «Pasar x10» | Sí | No |
| Plantillas | «Mi plantilla» (solo la tuya) | «Ver plantillas» (todos los clubes) |

---

## 4. Jugadores y valores

- La base de datos tiene más de 500 jugadores entre arqueros (**POR**), defensores (**DEF**), mediocampistas (**MED**) y delanteros (**DEL**): leyendas históricas, figuras actuales, planteles de clubes argentinos, y jugadores **troll** (de cargada futbolera, no ofensivos, con media baja).
- Cada jugador tiene **nombre, posición, media (1–99), país y club**. La bandera se muestra en la puja y en El Reloj.
- **Valor aleatorio:** en cada partida la media de cada jugador varía hasta ±10 respecto de su media base (nunca por debajo de 30 ni por encima de 99). Así un crack puede venir peor o un jugador discreto puede venir mejor. Los jugadores troll y los propios mantienen siempre su media fija.
- **Colores por media:** plateado (menos de 80), amarillo (80–89), naranja (90–95) y rojo (96 o más).
- **Valor de referencia en millones:** la media 30 vale 20M y la 99 vale unos 200M, de forma lineal. Los bots usan este valor para decidir cuánto pagan o piden.
- **Fútbol 11:** 1 arquero + 10 de campo. **Fútbol 5:** 1 arquero + 4 de campo. Todos los equipos de una partida tienen el mismo tamaño de plantel.

---

## 5. Pantalla de Ajustes

La pantalla es una lista de filas: a la izquierda el nombre del ajuste y a la derecha las opciones. La explicación aparece bajo la opción elegida. Abajo queda fija una barra con el resumen de lo elegido y el botón de empezar (**Comenzar Subasta**, **Comenzar fichajes**, **Repartir planteles** o **Empezar torneo**, según el modo). Algunos ajustes solo aparecen cuando aplican.

### Jugadores por equipo
**Fútbol 11** o **Fútbol 5**.

### Competencia

| Opción | Qué es |
|---|---|
| **Copa de la liga** | Fase de liga (todos contra todos) y después eliminatorias con los mejores clasificados. |
| **Liga** | Todos contra todos. El primero de la tabla es el campeón. |
| **Champions / Libertadores** | Fase de grupos de 4 equipos y playoffs. |
| **Copa** | Solo eliminatorias con cuadro sorteado. |

### Estilo Champions / Libertadores (solo si se elige Champions)
- **Fase de grupos:** *Solo ida* (3 partidos por equipo) o *Ida y vuelta* (6 partidos por equipo).
- **Regla del gol de visitante** (playoffs): *sin gol de visitante* (el empate global va a prórroga/penales) o *con gol de visitante* (con global igualado avanza el que más goles hizo de visitante).
- **Si sigue empatado:** *Prórroga y penales* (30 minutos extra y, si no alcanza, penales) o *Directo a penales*.
- Los playoffs son siempre de ida y vuelta; la final puede ser a partido único o ida y vuelta (ajuste «La final»).
- La cantidad de equipos va de a 4: 8, 12 o 16.

### Descensos (solo en Liga)
Cuántos equipos pierden la categoría al terminar: **Automático**, **Sin descensos** o de 1 a 5. Siempre quedan al menos 2 equipos sin descender. En automático: 0 descensos con 3 equipos o menos, 1 con 4–7, 2 con 8–11 y 3 con 12 o más.

### Partidos de ida y vuelta
- **Solo ida** o **Ida y vuelta** (en Liga: cada rival dos veces; en Copa: cada cruce a ida y vuelta).
- En Copa de la liga hay dos opciones más: **Ida y vuelta de liga** (liga a doble vuelta, eliminatorias a partido único) y **Todo ida y vuelta**.
- Esta tarjeta no aparece en Champions (los playoffs ya son siempre de ida y vuelta).

### La final
**Final a partido único** (un solo partido en cancha neutral) o **Final ida y vuelta** (dos partidos con global; el mejor ubicado cierra de local). No aparece en Liga pura.

### Mercado de pases
- **Sin mercado / Con mercado** de pases antes del torneo (ver [sección 7](#7-mercado-de-pases)). En **Custom** esta tarjeta no aparece: el plantel queda como lo armó el usuario.
- **¿Los bots pueden ofertar por tus jugadores?** (solo si hay bots): Sí / No.
- **¿Incluir Jugadores Libres?** Sí / No.
- **Duración del mercado de pases:** 3, 5 o 10 minutos, o sin límite. Solo aplica en salas online.

### Jugadores troll
**Sin troll**, **Con troll** (mezclados con los reales) o **Solo troll** (todos los jugadores son troll; limita la cantidad máxima de equipos porque hay pocos arqueros troll).

### Jugadores propios (modo Predio)
Aparece solo en el modo **Predio** (local y online); en **Normal** no hay nada de jugadores creados en Ajustes. La tarjeta **Jugadores del predio** tiene dos opciones: **Crear ahora** (por defecto) y **Usar ya creados**. Con «Usar ya creados» aparece el botón **Crear y editar jugadores** y cuántos equipos alcanzan con los jugadores guardados. Se explica en la [sección 16](#16-jugadores-propios-y-modo-predio). En **Custom** esta tarjeta no aparece (los jugadores se crean en su propia pantalla).

### Presupuesto inicial
**500M, 1000M, 1500M o 2000M** por equipo. Debajo se indica cuánto es por jugador, aproximadamente. En Aleatorio sin mercado y en Custom esta opción no se muestra porque el dinero no se usa.

### Duración de cada puja / del reloj
- Puja: **5 s**, **10 s**, **15 s** o **Sin tiempo**.
- El Reloj: **8 s** (cae rápido), **10 s** o **15 s** (cae lento). Es el tiempo que tarda el precio en bajar.
- No aparece en Aleatorio.

### Veces que cada equipo puede saltear la oferta (Puja multijugador)
Cuántas veces puede plantarse (✋) cada equipo en toda la subasta: sin límite, 30, 15, 10, 5, 3 o ninguna.

### Veces que podés usar «Pasar x10» (Un jugador, Puja y El Reloj)
Sin límite, 10, 5, 3, 1 o ninguna.

### Dificultad de los bots
**Fácil** (se equivocan y reaccionan lento), **Regular** (valoran bien, a veces fallan) o **Difícil** (calculan, cuidan la plata y no perdonan). Afecta la Puja, El Reloj y el Mercado de pases (ver [sección 7](#7-mercado-de-pases)).

### Cantidad de participantes y nombres
- De **2 a 16** equipos (Champions: 8, 12 o 16). Debajo se indican los partidos por equipo, las rondas o cuántos clasifican.
- Cada equipo tiene un campo de nombre. Tocar el **número del equipo** abre el editor de club ([sección 15](#15-personalización-de-clubes)).
- **Borrar nombres y estadios** vacía los nombres y los estadios (los colores se mantienen; un nombre vacío usa el original).
- **Restaurar nombres, colores y estadios** vuelve todo a los valores de fábrica.
- En **Un jugador**, la etiqueta **Jugador/CPU** de cada equipo permite elegir cuál es el tuyo.

### Resumen de partidos y clasificados según la cantidad de equipos
- **Liga:** `(n − 1)` partidos por equipo (el doble con ida y vuelta).
- **Copa de la liga:** con 2 equipos no hay liga, van directo a la final; con 3, el primero de la liga es campeón directo; con 4 a 6 clasifican 2 (final); con más, clasifica aproximadamente la mitad (nunca 6: con 11 o 12 equipos pasan 8).
- **Champions:** clasifican los 2 primeros de cada grupo; si eso no completa un cuadro, se suman los mejores terceros (por ejemplo con 12 equipos: 6 + 2 mejores terceros = 8).
- **Copa:** todos entran; si la cantidad no es potencia de 2, algunos pasan directo en la primera ronda (*bye*).

---

## 6. Formas de armar los planteles

Hay tres modos (y un cuarto, **Custom**, solo en Predio local: los planteles los arma el usuario a mano, ver [sección 16](#16-jugadores-propios-y-modo-predio)). Todos garantizan **1 arquero por equipo** y todos los equipos terminan con el plantel completo.

### Puja
Subasta con jugadores **anónimos**: de cada jugador solo se ven su **posición** y su **país**. El nombre, el club y la media se revelan recién cuando se vende.

- **Orden:** primero la **ronda de arqueros** (para que cada equipo tenga uno) y después la **ronda libre**, donde cualquiera puede pujar por cualquier posición.
- **Precio:** arranca en **20M** y sube de a **10M**, sin tope.
- **Reserva obligatoria:** a cada equipo siempre le tiene que quedar plata para completar su plantel (20M por cada puesto que le falte). Por eso el máximo que puede ofrecer es su presupuesto menos esa reserva.
- **Si nadie puja:** el jugador vuelve al final de la lista (hasta dos veces). Si a un equipo solo le alcanza para el precio base, se queda el jugador a 20M.
- **Si se agota la lista:** los planteles incompletos se completan por sorteo a 20M por jugador.
- **Revelación:** tras cada venta se muestra el jugador revelado, quién lo compró y a cuánto. El juego queda en pausa hasta tocar **Siguiente oferta** (o Enter / Espacio).

**Un jugador (por turnos):** los equipos pujan por turno. En tu turno podés **Ofertar** (+10M) o **Pasar**. Si hay reloj y se acaba, pasás automáticamente. Los bots deciden de antemano hasta cuánto pagan por cada jugador según su dificultad, su plata y las posiciones que les faltan.

**Botón «Pasar x10»:** tu equipo se planta en los próximos 10 jugadores y los bots pujan y fichan rápido. Mientras corre se convierte en **Detener**. Los usos son limitados según el ajuste (el uso ya gastado no se devuelve).

**Multijugador local (puja libre):** no hay turnos. Cada equipo tiene una fila con un campo de monto, **Ofertar** y ✋ (**me planto**). Si el campo queda vacío, se oferta automáticamente el mínimo siguiente. La puja se cierra cuando se acaba el tiempo sin nuevas ofertas, o apenas todos los demás se plantaron o quedaron sin saldo. Con límite de pases, cada ✋ muestra cuántos le quedan. El botón **Todos pasan** planta a todos los que no lideran (y el que lidera se queda el jugador).

### El Reloj (subasta al revés)
Sale un jugador anónimo (se ve su posición y su país) con un **precio muy alto que baja en vivo**. El primero en apretar **¡FICHAR!** se lo queda al precio de ese momento.

- El precio inicial depende de lo que vale el jugador (aproximadamente 2,2 veces su valor de referencia, mínimo 60M) y baja de forma lineal hasta **10M** durante la duración elegida.
- **Control:** en Un jugador se ficha con la **barra espaciadora**; en multijugador, cada equipo tiene su botón y su tecla (1 al 9, 0, Q, W, E…).
- **Reserva obligatoria:** igual que en la Puja, no se puede fichar si no queda plata para completar el plantel (10M por puesto faltante).
- **Si nadie ficha:** el reloj se queda un momento en el mínimo y el jugador vuelve al final de la lista (hasta dos veces).
- **Bots:** cada bot decide a qué precio compra y cuánto tarda en reaccionar según su dificultad. En Fácil se distraen o tardan; en Difícil casi no esperan y no malgastan plata en posiciones que no necesitan.
- Mantiene la ronda de arqueros previa, la pausa para ver al jugador revelado y el botón **Pasar x10** en Un jugador.

### Aleatorio
Sin subasta. El juego reparte los planteles al azar: primero un arquero a cada equipo y después jugadores de campo hasta completar. Cada equipo recibe también el presupuesto inicial, que solo sirve para el mercado de pases. Si no se activa el mercado, el torneo arranca de inmediato.

---

## 7. Mercado de pases

Pantalla opcional entre el armado de planteles y el torneo. Se usa la plata que sobró.

### Pestañas
- **Jugadores:** todos los jugadores de los demás equipos. Se puede filtrar por equipo y por posición. Un panel lateral muestra los presupuestos y los movimientos.
- **Ofertas:** ofertas recibidas y enviadas, con **Novedades** (aceptaciones, rechazos, retiros).
- **Jugadores Libres:** jugadores que nadie fichó. Solo aparece si se activó la opción.

### Cómo se oferta
Cada operación es **dinero + un jugador tuyo a cambio** por un jugador de otro equipo, para que las plantillas sigan completas. En la pantalla de oferta se elige el dinero (con atajos), el jugador a entregar y se ve el resumen.

Reglas:
- Los **arqueros solo se intercambian por arqueros**, y ningún equipo puede quedarse sin arquero.
- El monto tiene que ser un número entero y no puede superar el presupuesto.
- Hasta **8 ofertas pendientes** a la vez por equipo humano; no se puede ofertar dos veces por el mismo jugador ni ofrecer el mismo jugador propio en dos ofertas.
- El dueño del jugador **acepta o rechaza**. El que ofertó puede **retirarla**.
- Los equipos CPU responden solos después de «pensarlo» entre 1 y 3 segundos.

### Jugadores Libres
- Cuestan **2,5 veces su valor de referencia** (mínimo 50M).
- Ficharlos obliga a **liberar a uno de tus jugadores**, que pasa a ser libre. No podés quedarte sin arquero.

### Notificaciones
Punto rojo con número en la pestaña Ofertas y en el botón de cada equipo (ofertas por responder + novedades sin ver), banner **Ver ofertas** en las otras pestañas y avisos emergentes cuando te mandan, aceptan, rechazan o retiran una oferta (con el motivo si fue un bot).

### Selector «Ofertar como» (multijugador local)
Un botón por equipo humano, con su presupuesto, para elegir con quién se opera.

### Bots en el mercado
- **Cómo responden una oferta:** comparan el dinero más el jugador que reciben contra lo que vale el que pierden, y además miran cómo cambia su equipo: si debilita su once ideal, si desequilibra el plantel, si es una de sus figuras (la cobran más cara), si el comprador es un rival fuerte (recargo) y cuánta plata les queda.
- **Rechazos con motivo:** pueden negarse porque la operación los dejaría sin jugadores en una línea, les desequilibraría demasiado el plantel, les debilitaría el once o simplemente no alcanza el dinero.
- **Por dificultad:** Fácil casi no mira nada de eso y a veces acepta por impulso; Regular mira todo con moderación; Difícil lo mira todo, exige margen y cobra más por sus figuras.
- **Ofertas hacia vos** (si está activado): los bots te mandan ofertas por tus jugadores. Cuántas, con qué frecuencia y a qué precio depende de la dificultad.
- **Entre bots:** se ofertan entre ellos y fichan jugadores libres.

### Terminar el mercado
- **Un jugador / multijugador local:** botón **Saltar / terminar mercado de pases**.
- **Online:** hay un reloj visible para todos (se pone rojo en los últimos 30 s) y el mercado se salta por **votación**: cada jugador conectado vota y con la **mayoría** arranca el torneo. El voto se puede quitar. Si se acaba el tiempo, arranca solo.

---

## 8. Sorteo

Hay una pantalla de sorteo animada en **Champions** (grupos) y **Copa** (cruces de la primera ronda), cuando hay 3 o más equipos. El resultado ya está definido; la animación solo lo revela. Se puede **saltar la animación** o **Continuar**.

- **Champions:** los grupos se sortean totalmente al azar, sin bombos: cualquiera puede enfrentarse a cualquiera.
- **Copa:** los cruces se sortean al azar.

---

## 9. Fase de liga y fase de grupos

### Pantalla
- **Navegación de jornadas** (← Anterior / Siguiente) con el número de jornada.
- **Simular jornada**, **Auto jornadas** y **Simular liga completa**.
  - *Auto jornadas* simula las jornadas una por una, solas, mostrando la jornada y luego los resultados con la tabla moviéndose. Un segundo toque la pausa. Mientras está activo, los demás botones no responden.
  - Los botones de simulación se bloquean cuando ya no hay nada para simular.
- **Ver plantillas** / **Mi plantilla** ([sección 14](#14-plantillas-y-equilibrio-del-plantel)).
- **Ir a la fase eliminatoria** (Copa de la liga y Champions), disponible cuando termina la fase de liga.
- Cada partido muestra los equipos (con su color o escudo), el resultado, y el **estadio** del local.

### Tabla de posiciones
Columnas: posición, equipo, PJ, PG, PE, PP, GF, GC, DG y Pts. **Victoria 3 puntos, empate 1.**

**Desempate (y siembra de la eliminatoria):** 1.º más puntos, 2.º mejor diferencia de gol, 3.º más goles a favor.

La tabla va en una **barra lateral** que se puede ocultar y mostrar. Las filas suben y bajan con animación, la zona cambia de color progresivamente y los puntos «saltan». Los colores indican:

| Zona | Significado |
|---|---|
| Zona de clasificación | Está dentro de los clasificados |
| Ya clasificado | Aseguró su lugar aunque pierda todo lo que le queda |
| Mejor tercero | Clasificaría como mejor tercero (Champions) |
| Eliminado / descenso | Ya no puede clasificar, o está en zona de descenso |
| Campeón | El líder, cuando ya nadie lo puede alcanzar (Liga) |

En **Liga** se marcan además los equipos que descienden y se muestra el campeón.

### Champions: fase de grupos
- Grupos de 4 equipos, cada uno con su propia tabla (**Grupo A, B, C…**).
- Clasifican los 2 primeros de cada grupo y, si hace falta, los mejores terceros (comparados por puntos, diferencia de gol y goles a favor).
- Los partidos de todos los grupos se juegan en las mismas jornadas.

### Aviso de eliminado
En Un jugador, si tu equipo ya no puede clasificar o queda afuera, aparece un cartel con opciones: seguir viendo la liga, ver la tabla o ver los playoffs.

---

## 10. Fase eliminatoria y Copa

### Cuadro
- Los clasificados se **siembran** según la tabla de la liga: 1.º contra el último, 2.º contra el penúltimo, etc. Si no completan un cuadro, los mejor sembrados pasan directo (*bye*).
- El **mejor sembrado es el local**. En ida y vuelta, el mejor sembrado abre de visitante y **cierra de local**.
- En **Champions** no se cruzan equipos del mismo grupo si se puede evitar, y es local el que sumó más puntos en la fase de grupos.
- En **Copa** todos entran, el sorteo define los cruces y **en cada ronda se vuelve a sortear** entre los que siguen en carrera.
- El cuadro se dibuja con líneas que conectan cada cruce: línea llena con animación cuando está decidido, punteada cuando está pendiente. Se redibujan solas al cambiar de tamaño la pantalla.

### Cómo se juega cada ronda
**Cómo jugar:** *Todos a la vez* (todos los partidos pendientes de la ronda juntos, hasta 4 en pantalla) o *Uno por uno*. Se avanza con **Jugar siguiente ronda**.

### Localía
- Los partidos con local tienen ventaja de local.
- Son en **cancha neutral** (sin ventaja): la final a partido único (siempre) y, en la Copa, todos los partidos únicos.
- En Copa de la liga, los demás partidos únicos mantienen la localía según la posición en la tabla.

### Definición de los cruces
- **Partido único:** si hay empate se juega **prórroga de 30 minutos** y después **penales**.
- **Ida y vuelta:** se suman los goles de los dos partidos. Si el global queda igualado, en el partido de vuelta hay prórroga y penales.
- **Gol de visitante:** solo existe en Champions si se activó. Con global igualado avanza el que más goles hizo de visitante.
- **Directo a penales:** en Champions se puede elegir saltear la prórroga.

### Casos especiales
- Con 2 equipos no hay liga: van directo a la final.
- Con 3 equipos en Copa de la liga no hay final: el primero de la liga sale campeón directo.

### Festejo
Al definirse el campeón aparece una pantalla con confeti, el escudo o color del club y su plantel armado en la cancha, con un botón para volver a ver el cuadro. Si sos de un equipo eliminado, ves tu cartel de eliminación.

---

## 11. Cómo se simulan los partidos

### Fuerza de un equipo
La fuerza es la **media del plantel** (promedio de la media de todos sus jugadores). La diferencia de media entre los dos equipos desplaza los goles esperados de cada uno.

### Goles esperados
Para cada equipo se calcula una expectativa de goles a partir de:
- una base (aproximadamente 1,1 goles en liga y 1,2 en eliminatorias),
- la diferencia de media (cada punto de diferencia suma o resta un poco),
- una dosis de azar,
- la **ventaja de local** (multiplica los goles del local y reduce los del visitante; en cancha neutral no se aplica),
- el **equilibrio del plantel** de ambos equipos (ver [sección 14](#14-plantillas-y-equilibrio-del-plantel)),
- el efecto de **tarjetas y suspensiones** ([sección 12](#12-tarjetas-suspensiones-y-var)).

Con esa expectativa se sortea la cantidad de goles con una distribución tipo Poisson. Además, cada equipo tiene una pequeña chance de **goleada sorpresa** (1 a 3 goles extra). Un equipo claramente más fuerte sigue siendo favorito aunque juegue de visitante.

### Quién marca y quién asiste
- **Goleadores:** se eligen con probabilidad según posición (los delanteros pesan mucho más que los mediocampistas, y estos más que los defensores; el arquero casi nada) y según la media del jugador.
- **Asistencias:** aproximadamente el 78 % de los goles tienen asistencia, que sale sobre todo de mediocampistas y delanteros.
- Los jugadores suspendidos o expulsados no protagonizan jugadas.

### Partidos en vivo (fase eliminatoria)
Los partidos de la fase eliminatoria se ven **en vivo** con un relato minuto a minuto:
- Un partido de 90 minutos dura aproximadamente 1 minuto real a velocidad normal. **Velocidad** x1, x2, x4 o x8; **Pausar**; **Saltar al final**.
- Hay tiempo añadido en cada tiempo, jugadas de peligro que no terminan en gol (tipos: penal, tiro libre, córner, contraataque, cabezazo, disparo desde lejos, mano a mano con el arquero y otros), **goles agónicos** (del minuto 89 en adelante) y marcador, cronómetro y estadio en cada tarjeta.
- Si hace falta, se juega la **prórroga** (con sus propios goles y goles agónicos) y la **tanda de penales**.
- **Penales:** 5 por equipo (se corta si uno ya no puede ser alcanzado) y luego muerte súbita. La probabilidad de convertir es de alrededor del 75 %, con una pequeña ventaja para el equipo de mayor media. Patean los jugadores de campo primero y los arqueros al final; no patean suspendidos ni expulsados.
- Un resumen de **Global** y **Penales** se muestra debajo del marcador cuando corresponde.

La fase de liga y la de grupos se simulan directamente por jornada (sin relato).

---

## 12. Tarjetas, suspensiones y VAR

### Tarjetas
- Cada equipo recibe en promedio **0,7 amarillas por partido** y tiene una chance de **1,5 %** de roja directa.
- La **segunda amarilla en el mismo partido** es expulsión.
- Los defensores y mediocampistas se llevan más tarjetas que los delanteros, y los arqueros muy pocas.
- Un jugador expulsado deja a su equipo con uno menos: baja la expectativa de goles de ese equipo (más cuanto antes ocurra) y sube la del rival.

### Suspensiones
- **Solo existen en la fase eliminatoria.** En liga y grupos no hay suspendidos ni acumulación de amarillas.
- La disciplina arranca en cero cuando empieza la eliminatoria y también en cada torneo nuevo.
- **3 amarillas acumuladas = 1 partido de suspensión.** La roja directa o la doble amarilla = 1 partido.
- Un jugador suspendido no juega: no aparece en ninguna jugada, no patea penales y su equipo pierde algo de fuerza (más cuanto mejor es el jugador).
- Al empezar un partido se avisa quiénes están ausentes por suspensión.

### VAR
- Aproximadamente el **16 % de los goles** se revisan, y la decisión es **50/50**.
- En el relato en vivo el gol aparece y el marcador sube; unos segundos después se anuncia «VAR: se revisa el gol de…» (parpadea) y, finalmente, **gol válido** o **GOL ANULADO** con su motivo (fuera de juego, falta previa o mano). Si se anula, el marcador vuelve atrás y el gol queda tachado en la lista.
- Un gol anulado **no suma al marcador ni a las estadísticas** (goleadores y asistencias), así que puede cambiar si hay prórroga o penales. También se revisan los goles de la prórroga.
- De vez en cuando el VAR llama al árbitro por un posible penal y lo desestima.
- Cada momento tiene su sonido (tensión al empezar la revisión, gol al confirmarse y un sonido de rechazo al anularse).

---

## 13. Estadísticas, premios y XI ideal

### Tabla de goleadores y asistentes
Con un selector **Goleadores / Asistentes**. Se muestran los 15 mejores con su posición, jugador, club y cantidad. Los desempates son por la otra estadística y luego por media.

### Valla invicta
Cuando un equipo termina un partido sin recibir goles, suma valla invicta para su mejor arquero (3 puntos de rendimiento) y para sus 2 mejores defensores (1,5 puntos cada uno). Cuenta para el «Mejor jugador».

### Premios individuales (al terminar el torneo)
- **Pichichi:** el máximo goleador.
- **Máx. asistente.**
- **Mejor jugador:** puntaje = 3 por gol + 2 por asistencia + vallas invictas + 2 si juega en el equipo campeón.

### XI Ideal del Torneo
Se arma solo al terminar, con los mejores rendimientos de todos los clubes (goles, asistencias, vallas invictas, bono por ser del campeón y la media del jugador). Se muestra en una cancha, con **formación 4-3-3** en Fútbol 11 y **1-2-1** en Fútbol 5.

---

## 14. Plantillas y equilibrio del plantel

### Ver plantillas / Mi plantilla
Disponible desde la puja, El Reloj, el sorteo, el mercado, la liga y las eliminatorias.
- En **Un jugador** (y en cualquier sala online) abre directamente **tu** plantel. En **Multijugador Local** primero se elige el club (**← Clubes** vuelve a la lista).
- Se muestra una **cancha con cada jugador como ficha arrastrable** (posición, media y nombre). El acomodo se recuerda y es el que se ve en el festejo del campeón.
- Hay **formaciones predefinidas** para acomodar al plantel de un toque (por ejemplo 5-3-2, 3-4-3, 4-3-1-2, 4-3-2-1 y 4-5-1 en Fútbol 11, y otras para Fútbol 5).
- Se muestra la **media del plantel** con el color de su categoría y un cartel de **equilibrio**.

### Equilibrio del plantel
El juego castiga a los planteles descompensados, porque influyen en los goles a favor y en contra:

| Situación | Efecto |
|---|---|
| Plantel muy ofensivo (demasiados delanteros, pocos defensores) | Marca algo más, pero recibe muchísimos más goles |
| Plantel muy defensivo | Recibe menos, pero le cuesta muchísimo convertir |
| Una línea vacía (sin defensores, sin delanteros o sin mediocampistas en Fútbol 11) | Menos goles a favor y más en contra |
| Menos de 3 defensores en Fútbol 11 | La defensa queda expuesta |
| Sin arquero | Recibe muchísimos más goles |

Jugar con línea de 5 (5-4-1, 5-3-2) **no se castiga**: es un estilo defensivo válido. Ir muy arriba se castiga antes. En Fútbol 5 no se exige mediocampo. El cartel muestra tres estados: **Plantel equilibrado**, **algo desequilibrado** o **muy desequilibrado**, con el detalle del efecto.

Los bots también lo tienen en cuenta al evaluar ofertas en el mercado.

---

## 15. Personalización de clubes

Tocar el **número de un equipo** (en Ajustes, en la sala online o en el Anotador) abre el editor del club:

- **Color principal** (24 colores o uno propio, ajustado a un rango legible) y **color secundario** (aparece como mitad del punto de color).
- **Estadio:** hasta 60 caracteres. Si no se escribe, se usa «*Nombre del equipo*'s Stadium». Se muestra en los partidos de local.
- **Escudo** (solo en multijugador online): se puede armar dentro del juego con una **forma** (escudo, redondo, rombo, hexágono, banderín, cuadrado), un **diseño** (liso, mitades, franjas, banda, diagonal) y un **símbolo** (inicial, estrella, rayo, corona, balón) usando los dos colores del club, o **subir un PNG**, que se reduce a un tamaño chico. El escudo reemplaza al color en tablas, listas, puja, mercado, plantillas, cruces, festejo y partidos en vivo.
- En el Anotador solo están los dos colores.

**Clubes de fábrica:** los 16 equipos por defecto (Boca, River, Independiente, Racing, San Lorenzo, Estudiantes, Vélez, Rosario Central, Newell's, Talleres, Belgrano, Lanús, Argentinos, Huracán, Defensa y Justicia y Gimnasia) vienen con su estadio y sus colores. Lo que cambie el usuario manda sobre eso. Si se renombra un equipo con el nombre de uno de estos clubes, toma sus datos.

Los colores y clubes se recuerdan en el dispositivo.

---

## 16. Jugadores propios y modo Predio

### Editor de jugadores
En Ajustes (modo Predio, con **Usar ya creados**), **Crear y editar jugadores** abre un editor con:
- **Nombre** (obligatorio, hasta 28 caracteres; se eliminan `< > & " \` y acento grave),
- **Media** (1 a 99),
- **Posición** (POR, DEF, MED, DEL),
- **País** (opcional): texto libre con sugerencias de los países que ya tienen bandera. Si queda vacío, el jugador figura como «Custom» con una estrella. Un país que el juego no conoce muestra una bandera genérica.

Se pueden **agregar, editar y borrar** (incluido «Borrar todos»). No se repiten nombres (ni los de la base de datos) y se admiten hasta **200** jugadores. Se guardan en el navegador.

### Cómo se usan (Predio local)
En Ajustes, la tarjeta **Jugadores del predio** (solo en Predio) tiene dos opciones:

- **Crear ahora** (por defecto): al tocar **Comenzar** aparece la pantalla de creación, **equipo por equipo** («Equipo 2 de 4: River»). Cada equipo crea sus **11 jugadores** (5 en Fútbol 5) con **al menos un arquero** y avanza con **Siguiente equipo** (o vuelve con **← Equipo anterior**). En el último equipo el botón dice **Empezar partida** y arranca la puja, el reloj o el aleatorio con todos los jugadores creados. En «Un jugador» los equipos CPU también cargan los suyos (se marcan «· CPU»). Estos jugadores son solo de esa partida: no se agregan a tu lista guardada, pero se guardan con el torneo para poder retomarlo.
- **Usar ya creados:** se juega con los jugadores que guardaste con el editor. La cantidad máxima de equipos sale de lo que creaste: hace falta **1 arquero por equipo** y `equipos × plantel` jugadores en total. Si no alcanza, al tocar **Comenzar** aparece un aviso.

En ambos casos:
- Se juega **solo con jugadores creados**. Funciona en Puja, Aleatorio, El Reloj y el mercado de pases (incluidos los jugadores libres).
- La **media es fija** (no varía con el valor aleatorio).
- Los ids son estables: borrar un jugador lo marca como borrado en lugar de sacarlo, así una partida guardada sigue apuntando a los mismos jugadores.

### Custom (solo Predio local)
Aparece como cuarta opción, junto a **Puja**, **Aleatorio** y **El Reloj**, únicamente cuando en Local elegiste **Predio** (en Normal y en el multijugador online no existe). Se juega siempre con **jugadores creados** y los planteles no se reparten: **los armás vos, equipo por equipo**, con los equipos que ya configuraste en Ajustes.

- Va directo a Ajustes como multijugador local (sin bots ni subasta). En Ajustes **no aparece** la tarjeta *Jugadores del predio* (Crear ahora / Usar ya creados), ni el tiempo de puja; se mantienen formato, competencia, nombres y colores de los equipos. **No hay mercado de pases** (ni presupuesto): el plantel queda como lo armaste.
- **Armar planteles** abre una pantalla donde se crea cada jugador con **nombre, media, posición, país (opcional) y equipo**. El equipo se elige **mientras lo creás** (el formulario pasa solo al siguiente equipo cuando uno se completa; también se puede tocar un equipo del panel *Equipos* para elegirlo) o se deja **Sin equipo** y se asigna **después** con el selector de cada fila de la lista.
- **Descargar jugadores (.txt)** baja un archivo de texto (bloc de notas) con una línea por jugador: `Nombre | Posición | Media | País | Equipo`. **Cargar jugadores (.txt)** lo lee y crea todos los jugadores solos; el equipo se une por nombre (si no existe en la partida o ya está completo, queda sin equipo). Los nombres repetidos y las líneas con errores se avisan. El archivo se puede escribir o editar a mano (líneas con `#` son comentarios; la posición acepta POR, DEF, MED, DEL).
- Al **final de la partida** (liga terminada o campeón definido) aparece **Descargar jugadores (.txt)** en las pantallas de la liga y del cuadro y en el cartel del campeón: baja el mismo tipo de archivo, con el equipo en el que terminó cada jugador, listo para volver a cargarlo en otra partida.
- **Traer mis jugadores guardados** suma los que tenés guardados con el editor (llegan sin equipo, para repartirlos a mano).
- Cada equipo necesita **exactamente el plantel** (11 o 5) y **al menos un arquero**; un equipo completo no admite más jugadores. El botón de empezar se habilita cuando todos los equipos están listos.
- Los jugadores **sin equipo** no juegan.
- La media es fija, no hay nombres repetidos (tampoco con la base de datos) y los jugadores de la partida se guardan con el torneo para poder retomarlo.

### Predio online
Al crear una sala se elige **Normal** o **Predio**. En Predio, la configuración de la sala muestra la tarjeta **Jugadores del predio**, donde el anfitrión elige **Crear ahora** (por defecto) o **Usar ya creados**. Después de **Empezar partida**, todos pasan a una pantalla de Predio:

- **Crear ahora:** **cada club crea sus jugadores** (11 en Fútbol 11, 5 en Fútbol 5), con **al menos un arquero**. **Listo** solo se habilita con la cantidad completa y un arquero. Se puede volver a editar hasta que el anfitrión empiece.
- **Usar ya creados:** cada club aporta **los jugadores que tiene guardados** en su navegador (ya no hay que crearlos). Cada uno ve cuántos aporta y puede abrir **Crear y editar jugadores** para sumar más antes de tocar **Listo** (si edita, vuelve a quedar sin «Listo»). Para quedar listo hace falta al menos un jugador. El anfitrión solo puede empezar si **entre todos los clubes** hay **1 arquero por equipo** y `equipos × plantel` jugadores; si no alcanza, ve cuántos faltan.
- Cada uno ve quién terminó, pero **no ve los jugadores de los demás**, para no arruinar la puja.
- Cuando todos los conectados están listos, el anfitrión toca **Empezar partida** y arranca la puja, el reloj o el aleatorio con exactamente esos jugadores. Los nombres repetidos entre clubes se numeran («Nombre 2»).
- Esos jugadores reemplazan a los propios guardados mientras dura la sala y se restauran al salir.

---

## 17. Multijugador online

Menú de inicio → **Multijugador** → nombre del club (con el editor de club) → **Unirte a una sala** o **Crear una sala**.

### Crear una sala
1. Elegir **Normal** o **Predio**.
2. Elegir el modo: **Puja**, **Aleatorio** o **El Reloj**.
3. Configurar igual que en el multijugador local (en Predio, elegir también **Crear ahora** o **Usar ya creados**), y definir el **mínimo** y el **máximo** de equipos (mínimo 2, máximo 16).
4. Se genera un **código de 6 caracteres** que no se repite con salas activas. Hay un botón **Copiar código**.

### Unirte
Escribir el código y entrar a la sala de espera, donde se ve la lista de jugadores, su color y su club. El anfitrión empieza cuando hay al menos el mínimo de equipos. Un jugador puede **Salir de la sala** antes de empezar.

### Cómo funciona
- El **anfitrión corre el juego** (es un multijugador local con todos los equipos humanos). Los invitados reciben una copia en vivo de su pantalla y mandan sus acciones; el anfitrión solo acepta las de su propio equipo. Cada uno ve apagados los controles de los demás.
- **Avanzar fases, simular jornadas, reiniciar y volver al menú** son solo del anfitrión.
- En El Reloj, cada jugador ficha con **Espacio** (o tocando su botón).
- En una sala online no aparece «Todos pasan».
- **Volver al inicio:** queda un solo botón en el chip de la sala. El anfitrión cierra la sala para todos; cada invitado sale solo él.
- **Tabla de posiciones:** cada jugador la oculta o muestra para sí; si el anfitrión la oculta o muestra, se aplica a todos.
- **Mi plantilla:** cada jugador abre solo su plantel; los datos viajan dentro de la pantalla y la ventana se arma en su dispositivo.
- **Cartel de eliminado:** cada club que queda afuera ve el suyo (cae en eliminatorias, no clasifica a la fase eliminatoria o desciende en Liga) y se cierra solo cuando empieza el siguiente partido, o con **Seguir viendo el torneo**.
- **Descensos y ajustes** se sincronizan con la sala. El anfitrión puede cambiar el tipo de jugadores (Sin / Con / Solo propios) en vivo en Normal.

### Mercado de pases online
- Cada jugador tiene **su propia pantalla**: el anfitrión arma una vista aparte por jugador y se la manda solo a ese jugador. Cada vista tiene su propio estado (pestaña, filtros, oferta en armado) y siempre opera **para su propio equipo**.
- **Nadie ve las operaciones de otro equipo:** ofertas recibidas y enviadas, novedades, movimientos, banner y avisos se filtran por equipo. Los presupuestos y las plantillas de la lista de equipos siguen siendo públicos.
- Aceptar o rechazar una oferta solo lo hace su dueño; retirarla, solo quien la mandó.
- Reloj y votación para saltar el mercado: ver [sección 7](#7-mercado-de-pases). Si se acaba el tiempo, el torneo arranca solo (hay un respaldo que revisa el tiempo cada segundo aunque la pestaña esté en segundo plano).
- Todos pueden abrir su plantilla en cualquier momento.

### Conexión y robustez
- **Tiempo real** con WebSocket (Socket.io) contra el servidor Node.js. Una sala por código; nada se mezcla entre partidas.
- **Reconexión:** cada jugador recibe un token. Si se cae la conexión, el servidor le guarda el lugar **60 segundos** y el cliente se vuelve a unir solo. El anfitrión reenvía la pantalla completa. Si el anfitrión se cae un instante, la sala no se cierra para todos.
- **Keep-alive:** mientras hay una sala abierta, el cliente consulta `/health` cada 4 minutos para que el servicio gratuito no se duerma.
- Si un invitado se reconecta durante el mercado, recibe su última pantalla.

### Límites conocidos
- Si el anfitrión **refresca o cierra la pestaña**, la partida se pierde, porque su estado vive en el navegador (pasado el tiempo de gracia, la sala se cae).
- «Ver plantillas» de todos los clubes no existe online: cada uno ve la suya.
- La partida online no se guarda en el dispositivo.

---

## 18. Anotador

Modo **sin puja ni simulación**: se elige el campeonato y la cantidad de equipos, se escriben los nombres y **cada resultado lo carga la persona a mano**. Sirve para llevar un torneo real o una liga entre amigos. Es independiente del resto del juego, usa su propio estado y se guarda solo en el navegador.

### Configuración
- **Campeonato:** Copa de la liga, Liga, Champions / Libertadores o Copa (el cuadro de la Copa se arma por orden de la lista, o por sorteo animado si se usa el sorteo).
- **Cantidad de equipos:** hasta 16.
- **Nombres:** **Mezclar orden** y **Borrar nombres**. Cada equipo puede tener sus colores (toque en el número).
- **Descensos** (Liga), **fase de liga o grupos** (solo ida / ida y vuelta), **cruces eliminatorios** (partido único / ida y vuelta), **final** (partido único / ida y vuelta) y **regla del gol de visitante** (Champions).

### Funcionamiento
- Mismas reglas que el modo simulado: clasificados de Copa de la liga y de Champions, byes, siembra del cuadro, ida y vuelta, final doble y gol de visitante.
- **Sorteo animado** para Champions (grupos) y Copa (cruces), con el orden guardado en la partida.
- La **tabla de posiciones** va en la barra lateral (en Champions, una tabla por grupo), con zonas de clasificación, ya clasificado, eliminado, mejor tercero y campeón/descenso, igual que en el modo simulado.
- En las series de ida y vuelta con global empatado se pregunta **quién ganó por penales**.
- Cada club muestra su color en partidos, tabla y cruces.

---

## 19. Sonido, música y apariencia

### Engranaje de ajustes rápidos
Un único botón de engranaje, abajo a la derecha, siempre visible (también para los invitados online). Su panel incluye:
- **Modo claro / oscuro.**
- **Volumen de Sonidos** (efectos) y **volumen de Música**, que se guardan en el navegador.
- **Tema que suena** y controles **anterior / pausa / siguiente**.

### Efectos de sonido
Se **sintetizan con Web Audio** (no usan archivos): clics y hover de menús, puja, fichajes, ofertas, cuenta regresiva, pitidos, goles, goles agónicos, penales, VAR, festejos y campeón.

### Música de fondo
- **27 temas** que suenan en orden aleatorio, uno tras otro y en bucle. Arrancan con el primer clic o toque (regla de los navegadores).
- Un cartelito muestra **Artista - Tema**.
- Para agregar un tema: copiar el mp3 a `audio/musica/` y sumar una línea en `js/data/musica.js`.
- Los mp3 pesan unos 100 MB en total.

### Apariencia
- Fondo de estilo «estadio de noche» en modo oscuro y variante clara; tipografías propias guardadas en `fonts/` (**Inter**, **Jost** y **JetBrains Mono**), sin depender de servicios externos.
- Menú de entrada con tarjetas grandes, animaciones de entrada, ondas al tocar y respuesta táctil; respeta `prefers-reduced-motion`.
- **Celulares:** botones y campos más grandes en pantallas angostas o táctiles, zonas de toque de unos 44 px, campos de texto de 16 px (iOS no hace zoom), `100dvh` para el alto real, tablas que entran completas, sorteo que se adapta y espacio extra al final para que los botones flotantes no tapen el último botón.
- La tabla animada, el cuadro con líneas y los carteles funcionan igual en todos los modos.

---

## 20. Guardado automático

- Mientras estás en la **liga** o en la **eliminatoria**, el torneo se guarda cada 2 segundos (y al cerrar o ocultar la pestaña) en el almacenamiento del navegador.
- Al volver a abrir el juego aparece **¿Retomar tu torneo?**, con la fecha del guardado, y podés **Retomar** o **Empezar de nuevo**.
- Un torneo terminado no se ofrece para retomar.
- Las partidas online no se guardan en el dispositivo.
- El Anotador y los jugadores propios tienen su propio guardado.
- Si en Predio local jugaste con **Crear ahora** o con **Custom**, los jugadores de esa partida se guardan junto con el torneo.

---

## 21. Estructura del proyecto

```
index.html          HTML de todas las pantallas y carga ordenada de CSS y JS
css/                Estilos (26 archivos, el orden de carga define la cascada)
js/                 Un módulo por tema
js/data/            Base de jugadores y lista de música
fonts/              Tipografías propias
audio/musica/       Temas de fondo (mp3)
server.js           Servidor Node.js (Express + Socket.io)
db.js               Almacenamiento JSON del servidor
render.yaml         Configuración para Render.com
test.js             Pruebas del almacenamiento (npm test)
data/               Sesiones, salas y partidas del servidor (se ignora en git)
```

**El orden de los `<script>` en `index.html` importa:** todos los módulos comparten el mismo ámbito global.

### Módulos de JavaScript

| Módulo | Qué hace |
|---|---|
| `estado.js` | Estado global de la partida (competencia, reglas, equipos, fixture, tabla, eliminatoria). |
| `navegacion.js` | Cambio de pantallas y barra de pasos. |
| `dialogo.js` | Cuadros de confirmación propios. |
| `ajustes.js`, `configuracion-ui.js` | Pantalla de Ajustes, menú de inicio, tamaños de plantel, límites de equipos y resumen. |
| `subasta.js` | La Puja: pujas, turnos, puja libre, pases, «Pasar x10». |
| `reloj.js` | El Reloj: precio descendente, compra de bots. |
| `modo-aleatorio.js` | Reparto al azar de planteles. |
| `bots.js` | Inteligencia de los bots por dificultad (valoración, pujas, reloj, mercado). |
| `mercado.js`, `mercado-online.js` | Mercado de pases y su versión online (pantalla por jugador, reloj, votación). |
| `jugadores-propios.js`, `predio-online.js` | Editor de jugadores propios, y pantalla de creación de Predio (local y online). |
| `custom-local.js` | Modo Custom (Predio local): crear jugadores y asignarlos a los equipos ya configurados. |
| `sorteo.js` | Animación del sorteo de grupos y cruces. |
| `liga.js` | Equilibrio de plantel, fixture, grupos de Champions, tabla por grupo. |
| `modo-automatico.js` | Simulación de jornadas, tabla de posiciones, descensos, premios, goleadores. |
| `eliminatoria.js`, `avance-eliminatoria.js`, `llaves-lineas.js` | Cuadro de eliminatoria, siembra, avance y líneas. |
| `simulacion-partido.js` | Planificación de un partido (goles, VAR, prórroga, penales). |
| `partidos-en-vivo.js` | Relato en vivo, velocidad, pausa. |
| `tarjetas.js` | Tarjetas, suspensiones y revisiones del VAR. |
| `plantillas.js`, `xi-ideal.js` | Alineaciones arrastrables y XI ideal. |
| `festejo.js` | Festejo del campeón y carteles de eliminado. |
| `animacion-tablas.js` | Animación de filas de las tablas. |
| `colores-equipos.js` | Editor de club: colores, estadio, escudo. |
| `multijugador.js` | Salas online: conexión, sincronización, acciones. |
| `anotador.js` | Modo Anotador. |
| `guardado.js` | Guardado automático y recuperación del torneo. |
| `sonidos.js`, `musica.js`, `tema-inicial.js` | Efectos, música y tema claro/oscuro. |
| `entrada-caldera.js`, `inicio.js` | Animaciones de entrada y arranque. |

---

## 22. Servidor

`server.js` sirve los archivos estáticos y gestiona las salas con Socket.io. `db.js` guarda sesiones, salas y partidas en archivos JSON (`data/`), con escrituras atómicas y caché en memoria, sin dependencias nativas.

### Eventos

| Evento | Función |
|---|---|
| `create_room` / `join_room` | Crear una sala o unirse con código. |
| `rejoin_room` | Volver a unirse con el token tras una caída. |
| `set_color` / `set_club` | Color, segundo color, estadio y escudo del club. El servidor evita colores repetidos. |
| `start_game` / `update_room` | El anfitrión inicia la partida o cambia la configuración. |
| `player_action` | Acción de un invitado hacia el anfitrión, con validación y acuse (`{ok, error}`). |
| `host_sync` / `host_sync_player` | El anfitrión manda la pantalla a todos, o la de un jugador en particular (mercado). |
| `save_state` / `get_state` | Guardar y leer el estado de la partida. |
| `leave_room` / `disconnect` | Salir de la sala o perder la conexión. |

### Validaciones y límites
- `player_action` solo se acepta de un socket que esté en una sala con partida empezada, con un objeto de hasta **20 KB** y un máximo de **40 por segundo**.
- Escudo: hasta 70 KB. Estadio: hasta 60 caracteres.
- Ping/pong holgado (25 s / 60 s) y tiempos de espera ampliados para el balanceador de Render.

### Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto (por defecto 3000). |
| `RECONNECT_GRACE_MS` | Tiempo que se guarda el lugar de un jugador desconectado (por defecto 60000). |
| `CORS_ORIGIN` | Opcional. Restringe el origen permitido (varios separados por coma). Sin esta variable acepta cualquiera. |

`GET /health` responde para el chequeo de salud de Render y para el keep-alive del cliente.
