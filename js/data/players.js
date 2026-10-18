/* =========================================================
   BASE DE DATOS DE JUGADORES
========================================================= */
const RAW_PLAYERS = [
// Arqueros
["Lev Yashin","POR",92],["Gianluigi Buffon","POR",91],["Manuel Neuer","POR",93],["Iker Casillas","POR",90],
["Jan Oblak","POR",91],["Thibaut Courtois","POR",90],["Marc-André ter Stegen","POR",89],["Alisson Becker","POR",89],
["Gianluigi Donnarumma","POR",88],["Ederson","POR",88],["Petr Čech","POR",87],["Edwin van der Sar","POR",90],
["David de Gea","POR",86],["Hugo Lloris","POR",85],["Kepa Arrizabalaga","POR",81],["Keylor Navas","POR",85],
["Peter Schmeichel","POR",90],["Oliver Kahn","POR",92],["Dino Zoff","POR",89],["Claudio Bravo","POR",83],
// Defensores
["Paolo Maldini","DEF",95],["Franz Beckenbauer","DEF",96],["Fabio Cannavaro","DEF",90],["Carles Puyol","DEF",89],
["Sergio Ramos","DEF",91],["Virgil van Dijk","DEF",91],["Gerard Piqué","DEF",87],["Franco Baresi","DEF",93],
["Alessandro Nesta","DEF",90],["Thiago Silva","DEF",89],["Marcelo","DEF",88],["Roberto Carlos","DEF",91],
["Cafu","DEF",90],["Dani Alves","DEF",88],["Dani Carvajal","DEF",85],["Achraf Hakimi","DEF",86],
["David Alaba","DEF",87],["Antonio Rüdiger","DEF",86],["Kalidou Koulibaly","DEF",86],["Giorgio Chiellini","DEF",89],
["Leonardo Bonucci","DEF",87],["Éder Militão","DEF",85],["Trent Alexander-Arnold","DEF",86],["Alphonso Davies","DEF",85],
["Ashley Cole","DEF",88],["Philipp Lahm","DEF",90],["Rio Ferdinand","DEF",87],["Jaap Stam","DEF",88],
["Lilian Thuram","DEF",89],["Marcel Desailly","DEF",87],["Ruud Krol","DEF",88],["William Saliba","DEF",84],
["Rúben Dias","DEF",88],["Theo Hernández","DEF",85],
// Mediocampistas
["Zinedine Zidane","MED",97],["Johan Cruyff","MED",97],["Xavi Hernández","MED",92],["Andrés Iniesta","MED",93],
["Andrea Pirlo","MED",92],["Luka Modrić","MED",90],["Toni Kroos","MED",89],["Kevin De Bruyne","MED",92],
["Steven Gerrard","MED",90],["Frank Lampard","MED",88],["Paul Pogba","MED",85],["Kaká","MED",91],
["Rivaldo","MED",90],["Juan Román Riquelme","MED",89],["Sergio Busquets","MED",87],["Marco Verratti","MED",86],
["Casemiro","MED",87],["Fabinho","MED",84],["Jude Bellingham","MED",90],["Pedri","MED",87],
["Gavi","MED",83],["Michael Ballack","MED",88],["Roy Keane","MED",87],["Patrick Vieira","MED",88],
["Ronald Koeman","MED",87],["Clarence Seedorf","MED",88],["Xabi Alonso","MED",89],["Thiago Alcântara","MED",85],
["Bernardo Silva","MED",87],["Martin Ødegaard","MED",87],["Frenkie de Jong","MED",85],["Declan Rice","MED",84],
["N'Golo Kanté","MED",88],
// Delanteros
["Pelé","DEL",99],["Diego Armando Maradona","DEL",98],["Lionel Messi","DEL",99],["Cristiano Ronaldo","DEL",99],
["Kylian Mbappé","DEL",93],["Erling Haaland","DEL",92],["Ronaldinho","DEL",93],["Ronaldo Nazário","DEL",96],
["Romário","DEL",92],["Marco van Basten","DEL",93],["Thierry Henry","DEL",92],["Samuel Eto'o","DEL",90],
["Luis Suárez","DEL",91],["Neymar Jr","DEL",92],["Robert Lewandowski","DEL",92],["Karim Benzema","DEL",91],
["Sergio Agüero","DEL",89],["Didier Drogba","DEL",89],["Zlatan Ibrahimović","DEL",90],["Wayne Rooney","DEL",88],
["Fernando Torres","DEL",87],["Raúl González","DEL",89],["Alessandro Del Piero","DEL",88],["Francesco Totti","DEL",88],
["David Villa","DEL",87],["Mohamed Salah","DEL",90],["Harry Kane","DEL",90],["Vinícius Júnior","DEL",89],
["Antoine Griezmann","DEL",88],["George Best","DEL",90],["Eusébio","DEL",91],["Ferenc Puskás","DEL",92],
["Alfredo Di Stéfano","DEL",95],["Garrincha","DEL",93],["Gabriel Batistuta","DEL",89],["Hristo Stoichkov","DEL",89],
["Roberto Baggio","DEL",90],["Michael Owen","DEL",86],["Ruud van Nistelrooy","DEL",89],["Filippo Inzaghi","DEL",85],
["Julian Álvarez","DEL",85],["Ousmane Dembélé","DEL",85],["Bukayo Saka","DEL",86],["Rodrygo","DEL",83],
["Lautaro Martínez","DEL",87],["Victor Osimhen","DEL",86],
// Boca Juniors (plantel actual)
["Sergio Romero","POR",83],["Leandro Brey","POR",76],
["Marcos Rojo","DEF",81],["Nicolás Figal","DEF",78],["Ayrton Costa","DEF",78],["Frank Fabra","DEF",80],["Lautaro Di Lollo","DEF",76],
["Cristian Medina","MED",80],["Kevin Zenón","MED",81],["Alan Varela","MED",80],["Ander Herrera","MED",79],["Rodrigo Battaglia","MED",77],
["Edinson Cavani","DEL",85],["Miguel Merentiel","DEL",82],["Milton Giménez","DEL",78],
// River Plate (plantel actual)
["Franco Armani","POR",84],
["Paulo Díaz","DEF",81],["Leandro González Pírez","DEF",79],["Marcos Acuña","DEF",82],["Fabricio Bustos","DEF",78],
["Ignacio Fernández","MED",81],["Kevin Castaño","MED",78],["Matías Kranevitter","MED",76],["Santiago Simón","MED",76],
["Facundo Colidio","DEL",79],["Miguel Borja","DEL",81],["Maximiliano Salas","DEL",80],["Gonzalo Montiel","DEF",82],
// Jugadores "troll" (versión de cargada futbolera, no ofensiva)
["Cristiano Ronaldo (sin penales)","DEL",68],
["Gonzalo Higuaín (mano a mano)","DEL",58],
["El Diez del Potrero","MED",42],
["Golero Manos de Manteca","POR",35],
["Defensor Patadura","DEF",38],
["Delantero Offside Eterno","DEL",40],
["El Ídolo del Domingo a las 10","MED",46],
["Arquero que Sale Mal Siempre","POR",30],
["El Que Siempre Pide el Cambio","MED",37],
["9 de Área Chica (Fin de Semana)","DEL",50]
];

/* Club y nacionalidad de cada jugador real/troll (se muestran en la puja, aunque el nombre esté oculto) */
const PLAYER_INFO = {
"Lev Yashin":{country:"Unión Soviética",club:"Dinamo Moscú"},"Gianluigi Buffon":{country:"Italia",club:"Juventus"},
"Manuel Neuer":{country:"Alemania",club:"Bayern Múnich"},"Iker Casillas":{country:"España",club:"Real Madrid"},
"Jan Oblak":{country:"Eslovenia",club:"Atlético Madrid"},"Thibaut Courtois":{country:"Bélgica",club:"Real Madrid"},
"Marc-André ter Stegen":{country:"Alemania",club:"Barcelona"},"Alisson Becker":{country:"Brasil",club:"Liverpool"},
"Gianluigi Donnarumma":{country:"Italia",club:"PSG"},"Ederson":{country:"Brasil",club:"Manchester City"},
"Petr Čech":{country:"Chequia",club:"Chelsea"},"Edwin van der Sar":{country:"Países Bajos",club:"Manchester United"},
"David de Gea":{country:"España",club:"Manchester United"},"Hugo Lloris":{country:"Francia",club:"Tottenham"},
"Kepa Arrizabalaga":{country:"España",club:"Chelsea"},"Keylor Navas":{country:"Costa Rica",club:"PSG"},
"Peter Schmeichel":{country:"Dinamarca",club:"Manchester United"},"Oliver Kahn":{country:"Alemania",club:"Bayern Múnich"},
"Dino Zoff":{country:"Italia",club:"Juventus"},"Claudio Bravo":{country:"Chile",club:"Real Sociedad"},
"Paolo Maldini":{country:"Italia",club:"AC Milan"},"Franz Beckenbauer":{country:"Alemania",club:"Bayern Múnich"},
"Fabio Cannavaro":{country:"Italia",club:"Real Madrid"},"Carles Puyol":{country:"España",club:"Barcelona"},
"Sergio Ramos":{country:"España",club:"Real Madrid"},"Virgil van Dijk":{country:"Países Bajos",club:"Liverpool"},
"Gerard Piqué":{country:"España",club:"Barcelona"},"Franco Baresi":{country:"Italia",club:"AC Milan"},
"Alessandro Nesta":{country:"Italia",club:"AC Milan"},"Thiago Silva":{country:"Brasil",club:"Chelsea"},
"Marcelo":{country:"Brasil",club:"Real Madrid"},"Roberto Carlos":{country:"Brasil",club:"Real Madrid"},
"Cafu":{country:"Brasil",club:"AC Milan"},"Dani Alves":{country:"Brasil",club:"Barcelona"},
"Dani Carvajal":{country:"España",club:"Real Madrid"},"Achraf Hakimi":{country:"Marruecos",club:"PSG"},
"David Alaba":{country:"Austria",club:"Real Madrid"},"Antonio Rüdiger":{country:"Alemania",club:"Real Madrid"},
"Kalidou Koulibaly":{country:"Senegal",club:"Al-Hilal"},"Giorgio Chiellini":{country:"Italia",club:"Juventus"},
"Leonardo Bonucci":{country:"Italia",club:"Juventus"},"Éder Militão":{country:"Brasil",club:"Real Madrid"},
"Trent Alexander-Arnold":{country:"Inglaterra",club:"Real Madrid"},"Alphonso Davies":{country:"Canadá",club:"Bayern Múnich"},
"Ashley Cole":{country:"Inglaterra",club:"Chelsea"},"Philipp Lahm":{country:"Alemania",club:"Bayern Múnich"},
"Rio Ferdinand":{country:"Inglaterra",club:"Manchester United"},"Jaap Stam":{country:"Países Bajos",club:"Manchester United"},
"Lilian Thuram":{country:"Francia",club:"Juventus"},"Marcel Desailly":{country:"Francia",club:"AC Milan"},
"Ruud Krol":{country:"Países Bajos",club:"Ajax"},"William Saliba":{country:"Francia",club:"Arsenal"},
"Rúben Dias":{country:"Portugal",club:"Manchester City"},"Theo Hernández":{country:"Francia",club:"AC Milan"},
"Zinedine Zidane":{country:"Francia",club:"Real Madrid"},"Johan Cruyff":{country:"Países Bajos",club:"Ajax"},
"Xavi Hernández":{country:"España",club:"Barcelona"},"Andrés Iniesta":{country:"España",club:"Barcelona"},
"Andrea Pirlo":{country:"Italia",club:"Juventus"},"Luka Modrić":{country:"Croacia",club:"Real Madrid"},
"Toni Kroos":{country:"Alemania",club:"Real Madrid"},"Kevin De Bruyne":{country:"Bélgica",club:"Manchester City"},
"Steven Gerrard":{country:"Inglaterra",club:"Liverpool"},"Frank Lampard":{country:"Inglaterra",club:"Chelsea"},
"Paul Pogba":{country:"Francia",club:"Juventus"},"Kaká":{country:"Brasil",club:"AC Milan"},
"Rivaldo":{country:"Brasil",club:"Barcelona"},"Juan Román Riquelme":{country:"Argentina",club:"Boca Juniors"},
"Sergio Busquets":{country:"España",club:"Barcelona"},"Marco Verratti":{country:"Italia",club:"PSG"},
"Casemiro":{country:"Brasil",club:"Manchester United"},"Fabinho":{country:"Brasil",club:"Liverpool"},
"Jude Bellingham":{country:"Inglaterra",club:"Real Madrid"},"Pedri":{country:"España",club:"Barcelona"},
"Gavi":{country:"España",club:"Barcelona"},"Michael Ballack":{country:"Alemania",club:"Chelsea"},
"Roy Keane":{country:"Irlanda",club:"Manchester United"},"Patrick Vieira":{country:"Francia",club:"Arsenal"},
"Ronald Koeman":{country:"Países Bajos",club:"Barcelona"},"Clarence Seedorf":{country:"Países Bajos",club:"AC Milan"},
"Xabi Alonso":{country:"España",club:"Real Madrid"},"Thiago Alcântara":{country:"España",club:"Barcelona"},
"Bernardo Silva":{country:"Portugal",club:"Manchester City"},"Martin Ødegaard":{country:"Noruega",club:"Arsenal"},
"Frenkie de Jong":{country:"Países Bajos",club:"Barcelona"},"Declan Rice":{country:"Inglaterra",club:"Arsenal"},
"N'Golo Kanté":{country:"Francia",club:"Chelsea"},
"Pelé":{country:"Brasil",club:"Santos"},"Diego Armando Maradona":{country:"Argentina",club:"Boca Juniors"},
"Lionel Messi":{country:"Argentina",club:"Inter Miami"},"Cristiano Ronaldo":{country:"Portugal",club:"Al-Nassr"},
"Kylian Mbappé":{country:"Francia",club:"Real Madrid"},"Erling Haaland":{country:"Noruega",club:"Manchester City"},
"Ronaldinho":{country:"Brasil",club:"Barcelona"},"Ronaldo Nazário":{country:"Brasil",club:"Real Madrid"},
"Romário":{country:"Brasil",club:"Barcelona"},"Marco van Basten":{country:"Países Bajos",club:"AC Milan"},
"Thierry Henry":{country:"Francia",club:"Arsenal"},"Samuel Eto'o":{country:"Camerún",club:"Barcelona"},
"Luis Suárez":{country:"Uruguay",club:"Inter Miami"},"Neymar Jr":{country:"Brasil",club:"Al-Hilal"},
"Robert Lewandowski":{country:"Polonia",club:"Barcelona"},"Karim Benzema":{country:"Francia",club:"Al-Ittihad"},
"Sergio Agüero":{country:"Argentina",club:"Manchester City"},"Didier Drogba":{country:"Costa de Marfil",club:"Chelsea"},
"Zlatan Ibrahimović":{country:"Suecia",club:"AC Milan"},"Wayne Rooney":{country:"Inglaterra",club:"Manchester United"},
"Fernando Torres":{country:"España",club:"Liverpool"},"Raúl González":{country:"España",club:"Real Madrid"},
"Alessandro Del Piero":{country:"Italia",club:"Juventus"},"Francesco Totti":{country:"Italia",club:"AS Roma"},
"David Villa":{country:"España",club:"Barcelona"},"Mohamed Salah":{country:"Egipto",club:"Liverpool"},
"Harry Kane":{country:"Inglaterra",club:"Bayern Múnich"},"Vinícius Júnior":{country:"Brasil",club:"Real Madrid"},
"Antoine Griezmann":{country:"Francia",club:"Atlético Madrid"},"George Best":{country:"Irlanda del Norte",club:"Manchester United"},
"Eusébio":{country:"Portugal",club:"Benfica"},"Ferenc Puskás":{country:"Hungría",club:"Real Madrid"},
"Alfredo Di Stéfano":{country:"Argentina",club:"Real Madrid"},"Garrincha":{country:"Brasil",club:"Botafogo"},
"Gabriel Batistuta":{country:"Argentina",club:"Fiorentina"},"Hristo Stoichkov":{country:"Bulgaria",club:"Barcelona"},
"Roberto Baggio":{country:"Italia",club:"Juventus"},"Michael Owen":{country:"Inglaterra",club:"Liverpool"},
"Ruud van Nistelrooy":{country:"Países Bajos",club:"Manchester United"},"Filippo Inzaghi":{country:"Italia",club:"AC Milan"},
"Julian Álvarez":{country:"Argentina",club:"Atlético Madrid"},"Ousmane Dembélé":{country:"Francia",club:"PSG"},
"Bukayo Saka":{country:"Inglaterra",club:"Arsenal"},"Rodrygo":{country:"Brasil",club:"Real Madrid"},
"Lautaro Martínez":{country:"Argentina",club:"Inter de Milán"},"Victor Osimhen":{country:"Nigeria",club:"Galatasaray"},
"Sergio Romero":{country:"Argentina",club:"Boca Juniors"},"Leandro Brey":{country:"Argentina",club:"Boca Juniors"},
"Marcos Rojo":{country:"Argentina",club:"Boca Juniors"},"Nicolás Figal":{country:"Argentina",club:"Boca Juniors"},
"Ayrton Costa":{country:"Argentina",club:"Boca Juniors"},"Frank Fabra":{country:"Colombia",club:"Boca Juniors"},
"Lautaro Di Lollo":{country:"Argentina",club:"Boca Juniors"},"Cristian Medina":{country:"Argentina",club:"Boca Juniors"},
"Kevin Zenón":{country:"Argentina",club:"Boca Juniors"},"Alan Varela":{country:"Argentina",club:"Boca Juniors"},
"Ander Herrera":{country:"España",club:"Boca Juniors"},"Rodrigo Battaglia":{country:"Argentina",club:"Boca Juniors"},
"Edinson Cavani":{country:"Uruguay",club:"Boca Juniors"},"Miguel Merentiel":{country:"Uruguay",club:"Boca Juniors"},
"Milton Giménez":{country:"Argentina",club:"Boca Juniors"},"Franco Armani":{country:"Argentina",club:"River Plate"},
"Paulo Díaz":{country:"Chile",club:"River Plate"},"Leandro González Pírez":{country:"Argentina",club:"River Plate"},
"Marcos Acuña":{country:"Argentina",club:"River Plate"},"Fabricio Bustos":{country:"Argentina",club:"River Plate"},
"Ignacio Fernández":{country:"Argentina",club:"River Plate"},"Kevin Castaño":{country:"Colombia",club:"River Plate"},
"Matías Kranevitter":{country:"Argentina",club:"River Plate"},"Santiago Simón":{country:"Argentina",club:"River Plate"},
"Facundo Colidio":{country:"Argentina",club:"River Plate"},"Miguel Borja":{country:"Colombia",club:"River Plate"},
"Maximiliano Salas":{country:"Argentina",club:"River Plate"},"Gonzalo Montiel":{country:"Argentina",club:"River Plate"},
"Cristiano Ronaldo (sin penales)":{country:"Portugal",club:"Al-Nassr"},"Gonzalo Higuaín (mano a mano)":{country:"Argentina",club:"River Plate"},
"El Diez del Potrero":{country:"Argentina",club:"Atlético Barrial"},"Golero Manos de Manteca":{country:"Argentina",club:"Deportivo Suburbano"},
"Defensor Patadura":{country:"Argentina",club:"Atlético Potrero"},"Delantero Offside Eterno":{country:"Argentina",club:"Los Pibes FC"},
"El Ídolo del Domingo a las 10":{country:"Argentina",club:"Unión Vecinal"},"Arquero que Sale Mal Siempre":{country:"Argentina",club:"Social y Deportivo"},
"El Que Siempre Pide el Cambio":{country:"Argentina",club:"Amistosos FC"},"9 de Área Chica (Fin de Semana)":{country:"Argentina",club:"Liga del Barrio"}
};

/* Nota sobre los "jugadores troll": se incluyeron variantes de cargada futbolera
   (fallar penales, no definir mano a mano, arqueros flojos, ídolos de potrero)
   y personajes inventados. Se dejaron afuera los pedidos sobre la adicción de
   Maradona y la pierna de Messi por tratarse de burlas sobre problemas de salud
   y discapacidad de personas reales: eso no lo puedo generar aunque sea en joda. */


/* Más jugadores de Argentina y Brasil: [nombre, posición, media, país, club] */
const ARG_BRA_PLAYERS = [
// --- Boca Juniors ---
["Agustín Marchesín","POR",80,"Argentina","Boca Juniors"],
["Luis Advíncula","DEF",78,"Perú","Boca Juniors"],["Marcelo Weigandt","DEF",78,"Argentina","Boca Juniors"],
["Lautaro Blanco","DEF",77,"Argentina","Boca Juniors"],["Juan Barinaga","DEF",74,"Argentina","Boca Juniors"],
["Gary Medel","DEF",79,"Chile","Boca Juniors"],["Lucas Blondel","DEF",75,"Argentina","Boca Juniors"],
["Leandro Paredes","MED",84,"Argentina","Boca Juniors"],["Tomás Belmonte","MED",76,"Argentina","Boca Juniors"],
["Carlos Palacios","MED",77,"Chile","Boca Juniors"],["Milton Delgado","MED",73,"Argentina","Boca Juniors"],
["Agustín Martegani","MED",75,"Argentina","Boca Juniors"],["Williams Alarcón","MED",75,"Chile","Boca Juniors"],
["Exequiel Zeballos","DEL",78,"Argentina","Boca Juniors"],["Brian Aguirre","DEL",74,"Argentina","Boca Juniors"],
["Adam Bareiro","DEL",77,"Paraguay","Boca Juniors"],["Tomás Aranda","DEL",72,"Argentina","Boca Juniors"],
["Lucas Janson","DEL",75,"Argentina","Boca Juniors"],
// --- River Plate ---
["Santiago Beltrán","POR",74,"Argentina","River Plate"],
["Lucas Martínez Quarta","DEF",80,"Argentina","River Plate"],["Germán Pezzella","DEF",78,"Argentina","River Plate"],
["Lautaro Rivero","DEF",74,"Argentina","River Plate"],
["Enzo Pérez","MED",77,"Argentina","River Plate"],["Juan Fernando Quintero","MED",79,"Colombia","River Plate"],
["Giuliano Galoppo","MED",76,"Argentina","River Plate"],["Maximiliano Meza","MED",78,"Argentina","River Plate"],
["Manuel Lanzini","MED",78,"Argentina","River Plate"],["Aníbal Moreno","MED",79,"Argentina","River Plate"],
["Tomás Galván","MED",72,"Argentina","River Plate"],["Sebastián Boselli","MED",74,"Uruguay","River Plate"],
["Sebastián Driussi","DEL",82,"Argentina","River Plate"],["Agustín Ruberto","DEL",72,"Argentina","River Plate"],
["Ian Subiabre","DEL",72,"Argentina","River Plate"],
// --- Liga Profesional Argentina ---
["Facundo Cambeses","POR",76,"Argentina","Racing Club"],["Santiago Sosa","MED",76,"Argentina","Racing Club"],
["Adrián Martínez","DEL",77,"Argentina","Racing Club"],
["Rodrigo Rey","POR",79,"Argentina","Independiente"],["Kevin Lomónaco","DEF",76,"Argentina","Independiente"],
["Santiago Montiel","DEL",74,"Argentina","Independiente"],["Gabriel Ávalos","DEL",74,"Paraguay","Independiente"],
["Fernando Muslera","POR",80,"Uruguay","Estudiantes"],["Guido Carrillo","DEL",76,"Argentina","Estudiantes"],
["Santiago Ascacíbar","MED",77,"Argentina","Estudiantes"],["Eros Mancuso","DEF",75,"Argentina","Estudiantes"],
["Edwin Cetré","DEL",75,"Colombia","Estudiantes"],
["Orlando Gill","POR",77,"Paraguay","San Lorenzo"],["Iker Muniain","MED",76,"España","San Lorenzo"],
["Tomás Marchiori","POR",76,"Argentina","Vélez Sarsfield"],["Valentín Gómez","DEF",79,"Argentina","Vélez Sarsfield"],
["Claudio Aquino","MED",77,"Argentina","Vélez Sarsfield"],["Braian Romero","DEL",76,"Argentina","Vélez Sarsfield"],
["Nahuel Losada","POR",75,"Argentina","Lanús"],["Carlos Izquierdoz","DEF",76,"Argentina","Lanús"],
["Marcelino Moreno","MED",77,"Argentina","Lanús"],["Rodrigo Castillo","DEL",74,"Argentina","Lanús"],
["Guido Herrera","POR",76,"Argentina","Talleres"],["Rubén Botta","MED",75,"Argentina","Talleres"],
["Federico Girotti","DEL",76,"Argentina","Talleres"],
["Jorge Broun","POR",75,"Argentina","Rosario Central"],["Ángel Di María","MED",84,"Argentina","Rosario Central"],
["Enzo Copetti","DEL",77,"Argentina","Rosario Central"],["Alejo Véliz","DEL",75,"Argentina","Rosario Central"],
["Hernán Galíndez","POR",76,"Ecuador","Huracán"],
// --- Brasileirão ---
["Rossi","POR",80,"Argentina","Flamengo"],["Léo Pereira","DEF",80,"Brasil","Flamengo"],
["Danilo","DEF",80,"Brasil","Flamengo"],["Wesley","DEF",78,"Brasil","Flamengo"],["Alex Sandro","DEF",78,"Brasil","Flamengo"],
["Jorginho","MED",78,"Italia","Flamengo"],["Giorgian de Arrascaeta","MED",84,"Uruguay","Flamengo"],
["Gerson","MED",83,"Brasil","Flamengo"],["Nicolás de la Cruz","MED",79,"Uruguay","Flamengo"],
["Pedro","DEL",82,"Brasil","Flamengo"],["Bruno Henrique","DEL",80,"Brasil","Flamengo"],
["Everton Cebolinha","DEL",79,"Brasil","Flamengo"],["Samuel Lino","DEL",78,"Brasil","Flamengo"],
["Weverton","POR",82,"Brasil","Palmeiras"],["Gustavo Gómez","DEF",82,"Paraguay","Palmeiras"],
["Murilo","DEF",79,"Brasil","Palmeiras"],["Joaquín Piquerez","DEF",79,"Uruguay","Palmeiras"],
["Raphael Veiga","MED",80,"Brasil","Palmeiras"],["Richard Ríos","MED",79,"Colombia","Palmeiras"],
["Andreas Pereira","MED",78,"Brasil","Palmeiras"],["Vitor Roque","DEL",80,"Brasil","Palmeiras"],
["Flaco López","DEL",79,"Argentina","Palmeiras"],
["John","POR",78,"Brasil","Botafogo"],["Alexander Barboza","DEF",78,"Argentina","Botafogo"],
["Hugo Souza","POR",76,"Brasil","Corinthians"],["Memphis Depay","DEL",80,"Países Bajos","Corinthians"],
["Yuri Alberto","DEL",79,"Brasil","Corinthians"],["Rodrigo Garro","MED",78,"Argentina","Corinthians"],
["Rafael","POR",77,"Brasil","São Paulo"],["Lucas Moura","MED",77,"Brasil","São Paulo"],
["Jonathan Calleri","DEL",79,"Argentina","São Paulo"],["Luciano","DEL",77,"Brasil","São Paulo"],
["Oscar","MED",78,"Brasil","São Paulo"],
["Fábio","POR",77,"Brasil","Fluminense"],["Germán Cano","DEL",80,"Argentina","Fluminense"],
["Paulo Henrique Ganso","MED",76,"Brasil","Fluminense"],["Jhon Arias","DEL",78,"Colombia","Fluminense"],
["Sergio Rochet","POR",79,"Uruguay","Internacional"],["Alan Patrick","MED",78,"Brasil","Internacional"],
["Enner Valencia","DEL",77,"Ecuador","Internacional"],
["Tiago Volpi","POR",76,"Brasil","Grêmio"],["Walter Kannemann","DEF",79,"Argentina","Grêmio"],
["Franco Cristaldo","MED",76,"Argentina","Grêmio"],["Martin Braithwaite","DEL",76,"Dinamarca","Grêmio"],
["Everson","POR",77,"Brasil","Atlético Mineiro"],["Hulk","DEL",81,"Brasil","Atlético Mineiro"],
["Gustavo Scarpa","MED",79,"Brasil","Atlético Mineiro"],
["Cássio","POR",78,"Brasil","Cruzeiro"],["Kaio Jorge","DEL",77,"Brasil","Cruzeiro"],
["Matheus Pereira","MED",79,"Brasil","Cruzeiro"],
["Philippe Coutinho","MED",78,"Brasil","Vasco da Gama"],["Pablo Vegetti","DEL",79,"Argentina","Vasco da Gama"],
["Everton Ribeiro","MED",76,"Brasil","Bahia"]
];
ARG_BRA_PLAYERS.forEach(p=>{ PLAYER_INFO[p[0]]={country:p[3],club:p[4]}; });

/* Más jugadores de las 5 grandes ligas: [nombre, posición, media, país, club] */
const EXTRA_PLAYERS = [
["Rodri","MED",91,"España","Manchester City"],["Phil Foden","DEL",88,"Inglaterra","Manchester City"],
["Bruno Fernandes","MED",87,"Portugal","Manchester United"],["Son Heung-min","DEL",87,"Corea del Sur","Tottenham"],
["Emiliano Martínez","POR",87,"Argentina","Aston Villa"],["Cole Palmer","MED",86,"Inglaterra","Chelsea"],
["Alexis Mac Allister","MED",86,"Argentina","Liverpool"],["Gabriel Magalhães","DEF",86,"Brasil","Arsenal"],
["Andrew Robertson","DEF",85,"Escocia","Liverpool"],["James Maddison","MED",85,"Inglaterra","Tottenham"],
["Ollie Watkins","DEL",85,"Inglaterra","Aston Villa"],["Alexander Isak","DEL",85,"Suecia","Newcastle"],
["Bruno Guimarães","MED",85,"Brasil","Newcastle"],["Sandro Tonali","MED",84,"Italia","Newcastle"],
["David Raya","POR",85,"España","Arsenal"],["Cristian Romero","DEF",84,"Argentina","Tottenham"],
["Moisés Caicedo","MED",84,"Ecuador","Chelsea"],["Enzo Fernández","MED",84,"Argentina","Chelsea"],
["Christopher Nkunku","DEL",84,"Francia","Chelsea"],["Matthijs de Ligt","DEF",84,"Países Bajos","Manchester United"],
["Manuel Akanji","DEF",84,"Suiza","Manchester City"],["Kyle Walker","DEF",84,"Inglaterra","Manchester City"],
["Joško Gvardiol","DEF",84,"Croacia","Manchester City"],["Jeremy Doku","DEL",83,"Bélgica","Manchester City"],
["Kobbie Mainoo","MED",81,"Inglaterra","Manchester United"],["Lisandro Martínez","DEF",84,"Argentina","Manchester United"],
["Dejan Kulusevski","DEL",83,"Suecia","Tottenham"],["Vinícius Jr.","DEL",90,"Brasil","Real Madrid"],
["Federico Valverde","MED",88,"Uruguay","Real Madrid"],["Lamine Yamal","DEL",87,"España","Barcelona"],
["Ronald Araújo","DEF",85,"Uruguay","Barcelona"],["Jules Koundé","DEF",85,"Francia","Barcelona"],
["Eduardo Camavinga","MED",83,"Francia","Real Madrid"],["Aurélien Tchouaméni","MED",85,"Francia","Real Madrid"],
["Nico Williams","DEL",85,"España","Athletic Club"],["Iñaki Williams","DEL",83,"Ghana","Athletic Club"],
["Unai Simón","POR",86,"España","Athletic Club"],["Dani Olmo","MED",85,"España","Barcelona"],
["Marcos Llorente","MED",84,"España","Atlético Madrid"],["Rodrigo De Paul","MED",84,"Argentina","Atlético Madrid"],
["Robin Le Normand","DEF",83,"España","Atlético Madrid"],["Mikel Oyarzabal","DEL",84,"España","Real Sociedad"],
["Takefusa Kubo","DEL",83,"Japón","Real Sociedad"],["Álex Remiro","POR",84,"España","Real Sociedad"],
["Conor Gallagher","MED",82,"Inglaterra","Atlético Madrid"],["Alejandro Balde","DEF",82,"España","Barcelona"],
["Raphinha","DEL",86,"Brasil","Barcelona"],["Fermín López","MED",81,"España","Barcelona"],
["Kirian Rodríguez","MED",81,"España","Las Palmas"],["Giorgi Mamardashvili","POR",85,"Georgia","Valencia"],
["Isco Alarcón","MED",83,"España","Real Betis"],["Giovani Lo Celso","MED",82,"Argentina","Real Betis"],
["Nicolò Barella","MED",87,"Italia","Inter de Milán"],["Alessandro Bastoni","DEF",87,"Italia","Inter de Milán"],
["Hakan Çalhanoğlu","MED",86,"Turquía","Inter de Milán"],["Federico Dimarco","DEF",86,"Italia","Inter de Milán"],
["Mike Maignan","POR",87,"Francia","AC Milan"],["Rafael Leão","DEL",86,"Portugal","AC Milan"],
["Christian Pulisic","MED",83,"Estados Unidos","AC Milan"],["Dušan Vlahović","DEL",84,"Serbia","Juventus"],
["Bremer","DEF",86,"Brasil","Juventus"],["Manuel Locatelli","MED",83,"Italia","Juventus"],
["Kenan Yıldız","DEL",80,"Turquía","Juventus"],["Teun Koopmeiners","MED",84,"Países Bajos","Juventus"],
["Khvicha Kvaratskhelia","DEL",85,"Georgia","Napoli"],["Romelu Lukaku","DEL",82,"Bélgica","Napoli"],
["Alessandro Buongiorno","DEF",83,"Italia","Napoli"],["Alex Meret","POR",82,"Italia","Napoli"],
["Paulo Dybala","DEL",85,"Argentina","Roma"],["Lorenzo Pellegrini","MED",83,"Italia","Roma"],
["Gianluca Mancini","DEF",82,"Italia","Roma"],["Artem Dovbyk","DEL",84,"Ucrania","Roma"],
["Ademola Lookman","DEL",84,"Nigeria","Atalanta"],["Éderson","MED",82,"Brasil","Atalanta"],
["Marten de Roon","MED",81,"Países Bajos","Atalanta"],["Marco Carnesecchi","POR",82,"Italia","Atalanta"],
["Marcus Thuram","DEL",84,"Francia","Inter de Milán"],["Benjamin Pavard","DEF",84,"Francia","Inter de Milán"],
["Yann Sommer","POR",87,"Suiza","Inter de Milán"],["Henrikh Mkhitaryan","MED",83,"Armenia","Inter de Milán"],
["Matteo Darmian","DEF",81,"Italia","Inter de Milán"],["Denzel Dumfries","DEF",82,"Países Bajos","Inter de Milán"],
["Fikayo Tomori","DEF",83,"Inglaterra","AC Milan"],["Tijjani Reijnders","MED",82,"Países Bajos","AC Milan"],
["Youssouf Fofana","MED",81,"Francia","AC Milan"],["Matteo Guendouzi","MED",80,"Francia","Lazio"],
["Andrea Cambiaso","DEF",81,"Italia","Juventus"],["Moise Kean","DEL",81,"Italia","Fiorentina"],
["Jamal Musiala","MED",87,"Alemania","Bayern Múnich"],["Joshua Kimmich","MED",86,"Alemania","Bayern Múnich"],
["Leroy Sané","DEL",85,"Alemania","Bayern Múnich"],["Michael Olise","DEL",83,"Francia","Bayern Múnich"],
["Dayot Upamecano","DEF",82,"Francia","Bayern Múnich"],["Kim Min-jae","DEF",83,"Corea del Sur","Bayern Múnich"],
["Kingsley Coman","DEL",84,"Francia","Bayern Múnich"],["Serge Gnabry","DEL",82,"Alemania","Bayern Múnich"],
["João Palhinha","MED",85,"Portugal","Bayern Múnich"],["Aleksandar Pavlovic","MED",80,"Alemania","Bayern Múnich"],
["Florian Wirtz","MED",88,"Alemania","Bayer Leverkusen"],["Granit Xhaka","MED",86,"Suiza","Bayer Leverkusen"],
["Jeremie Frimpong","DEF",84,"Países Bajos","Bayer Leverkusen"],["Alejandro Grimaldo","DEF",86,"España","Bayer Leverkusen"],
["Jonathan Tah","DEF",84,"Alemania","Bayer Leverkusen"],["Edmond Tapsoba","DEF",83,"Burkina Faso","Bayer Leverkusen"],
["Lukas Hradecky","POR",84,"Finlandia","Bayer Leverkusen"],["Victor Boniface","DEL",82,"Nigeria","Bayer Leverkusen"],
["Patrik Schick","DEL",81,"República Checa","Bayer Leverkusen"],["Gregor Kobel","POR",88,"Suiza","Borussia Dortmund"],
["Nico Schlotterbeck","DEF",85,"Alemania","Borussia Dortmund"],["Niklas Süle","DEF",81,"Alemania","Borussia Dortmund"],
["Julian Brandt","MED",84,"Alemania","Borussia Dortmund"],["Marcel Sabitzer","MED",82,"Austria","Borussia Dortmund"],
["Emre Can","MED",81,"Alemania","Borussia Dortmund"],["Donyell Malen","DEL",82,"Países Bajos","Borussia Dortmund"],
["Karim Adeyemi","DEL",80,"Alemania","Borussia Dortmund"],["Serhou Guirassy","DEL",84,"Guinea","Borussia Dortmund"],
["Xavi Simons","MED",84,"Países Bajos","RB Leipzig"],["Loïs Openda","DEL",83,"Bélgica","RB Leipzig"],
["Benjamin Šeško","DEL",82,"Eslovenia","RB Leipzig"],["Amadou Haidara","MED",80,"Malí","RB Leipzig"],
["Willi Orbán","DEF",83,"Hungría","RB Leipzig"],["Péter Gulácsi","POR",82,"Hungría","RB Leipzig"],
["Castello Lukeba","DEF",81,"Francia","RB Leipzig"],["Omar Marmoush","DEL",83,"Egipto","Eintracht Frankfurt"],
["Kevin Trapp","POR",81,"Alemania","Eintracht Frankfurt"],["Marquinhos","DEF",87,"Brasil","PSG"],
["Bradley Barcola","DEL",83,"Francia","PSG"],["Warren Zaïre-Emery","MED",81,"Francia","PSG"],
["Vitinha","MED",85,"Portugal","PSG"],["Fabián Ruiz","MED",83,"España","PSG"],
["João Neves","MED",83,"Portugal","PSG"],["Nuno Mendes","DEF",83,"Portugal","PSG"],
["Lucas Hernández","DEF",83,"Francia","PSG"],["Milan Škriniar","DEF",82,"Eslovaquia","PSG"],
["Marco Asensio","DEL",80,"España","PSG"],["Gonçalo Ramos","DEL",80,"Portugal","PSG"],
["Randal Kolo Muani","DEL",82,"Francia","PSG"],["Lucas Beraldo","DEF",78,"Brasil","PSG"],
["Jonathan David","DEL",82,"Canadá","Lille"],["Angel Gomes","MED",80,"Inglaterra","Lille"],
["Bafodé Diakité","DEF",79,"Francia","Lille"],["Lucas Chevalier","POR",82,"Francia","Lille"],
["Alexandre Lacazette","DEL",81,"Francia","Olympique Lyon"],["Rayan Cherki","MED",80,"Francia","Olympique Lyon"],
["Corentin Tolisso","MED",79,"Francia","Olympique Lyon"],["Nicolás Tagliafico","DEF",79,"Argentina","Olympique Lyon"],
["Lucas Perri","POR",79,"Brasil","Olympique Lyon"],["Mason Greenwood","DEL",82,"Inglaterra","Olympique Marsella"],
["Pierre-Emile Højbjerg","MED",81,"Dinamarca","Olympique Marsella"],["Adrien Rabiot","MED",82,"Francia","Olympique Marsella"],
["Leonardo Balerdi","DEF",80,"Argentina","Olympique Marsella"],["Gerónimo Rulli","POR",80,"Argentina","Olympique Marsella"],
["Elye Wahi","DEL",78,"Francia","Olympique Marsella"],["Aleksandr Golovin","MED",81,"Rusia","AS Mónaco"],
["Denis Zakaria","MED",81,"Suiza","AS Mónaco"],["Thilo Kehrer","DEF",79,"Alemania","AS Mónaco"],
["Vanderson","DEF",80,"Brasil","AS Mónaco"],["Takumi Minamino","DEL",80,"Japón","AS Mónaco"],
["Folarin Balogun","DEL",79,"Estados Unidos","AS Mónaco"],["Wilfried Singo","DEF",79,"Costa de Marfil","AS Mónaco"],
["Brice Samba","POR",81,"Francia","Lens"],["Facundo Medina","DEF",80,"Argentina","Lens"],
// --- Defensores agregados (los que ya estaban en la base se omitieron) ---
["Pau Cubarsí","DEF",82,"España","Barcelona"],["Willian Pacho","DEF",83,"Ecuador","PSG"],
["Marc Guéhi","DEF",83,"Inglaterra","Crystal Palace"],["Micky van de Ven","DEF",83,"Países Bajos","Tottenham"],
["Ibrahima Konaté","DEF",84,"Francia","Liverpool"],["Levi Colwill","DEF",82,"Inglaterra","Chelsea"],
["Murillo","DEF",82,"Brasil","Nottingham Forest"],["Piero Hincapié","DEF",82,"Ecuador","Bayer Leverkusen"],
["Dean Huijsen","DEF",79,"España","Bournemouth"],["Pedro Porro","DEF",82,"España","Tottenham"],
["Kieran Trippier","DEF",82,"Inglaterra","Newcastle"],["Ben White","DEF",84,"Inglaterra","Arsenal"],
["Riccardo Calafiori","DEF",83,"Italia","Arsenal"],["Destiny Udogie","DEF",82,"Italia","Tottenham"]
];
EXTRA_PLAYERS.forEach(p=>{ PLAYER_INFO[p[0]]={country:p[3],club:p[4]}; });

// Jugadores de relleno generados para garantizar plantel suficiente (hasta 16 equipos x 11)
const FIRST_NAMES = ["Juan","Diego","Carlos","Luis","Pedro","Marco","Iván","Bruno","Tomás","Nicolás","Facundo","Franco","Martín","Agustín","Federico","Gonzalo","Emiliano","Matías","Joaquín","Santiago","Lucas","Damián","Ezequiel","Alejandro","Rodrigo","Sebastián","Maximiliano","Cristian","Adrián","Andrés"];
const LAST_NAMES = ["Gómez","Rodríguez","Fernández","López","Martínez","García","Pérez","Sánchez","Romero","Torres","Ruiz","Díaz","Álvarez","Molina","Ortiz","Suárez","Castro","Rojas","Silva","Núñez","Vega","Herrera","Acosta","Medina","Flores","Vargas","Peña","Cabrera","Ríos","Campos"];
function buildFiller(){
  const list=[]; const positions=["POR","DEF","DEF","DEF","MED","MED","MED","DEL","DEL"];
  let seed=1;
  for(let i=0;i<160;i++){
    const fn=FIRST_NAMES[(i*7+3)%FIRST_NAMES.length];
    const ln=LAST_NAMES[(i*13+5)%LAST_NAMES.length];
    const pos=positions[i%positions.length];
    const ovr=62+((i*17)%22); // 62-83
    list.push([`${fn} ${ln}`,pos,ovr]);
  }
  return list;
}
/* Jugadores troll: se agregan tal cual, con la media exacta indicada (no se randomiza ni se limita a 30+) */
const TROLL_PLAYERS = [
  ["Maradona Drogado", "DEL", 69, "Argentina"],
  ["Messi sin piernas", "DEL", 29, "Argentina"],
  ["Matias Solis", "MED", 38, "Argentina"],
  ["Eber", "DEF", 28, "Argentina"],
  ["Caballito", "MED", 37, "Argentina"],
  ["Shoshinho", "MED", 99, "Brasil"],
  ["Xo Xi", "DEF", 99, "China"],
  ["Bauti Ranzini", "MED", 72, "Argentina"],
  ["Carlos Ponce", "DEF", 71, "Argentina"],
  ["Tote", "DEF", 11, "Argentina"],
  ["Cavani recién nacido", "DEL", 10, "Uruguay"],
  ["Eber Prime", "DEF", 30, "Argentina"],
  ["Solis Pajeado", "MED", 49, "Argentina"],
  ["Davo Xeneize", "MED", 21, "Argentina"],
  ["La Cobra Sin Remera", "DEL", 22, "Argentina"],
  ["Dickson Choto", "DEF", 78, "Zimbabue"],
  ["Perry El ornitorrinco", "POR", 29, "Estados Unidos"],
  ["Momo", "DEL", 23, "Italia"],
  ["Tiziano Castagnol", "DEL", 22, "Francia"],
  ["Mamuel Pepela", "DEF", 49, "Italia"],
  ["Lamine Yamal con 9 años", "DEL", 38, "España"],
  ["Noni", "DEL", 51, "Argentina"],
  ["Romina", "MED", 49, "Argentina"],
  ["Silvia", "DEF", 50, "Argentina"],
  ["Mariana", "DEF", 51, "Argentina"],
  ["Tuculinho", "DEL", 69, "Brasil"],
  ["Ronaldo Sin Penales", "DEL", 70, "Portugal"],
  ["Mbappe Sin Trabas", "DEL", 62, "Francia"],
  ["La chota de Messi", "MED", 89, "Argentina"],
  ["Han Da VuskÄrla", "MED", 69, "Alemania"],
  ["Tela Emboke", "DEL", 71, "Sudáfrica"],
  ["DeacÂ Laclavo", "DEL", 67, "Polonia"],
  ["Nun-Ka-Faye", "DEL", 61, "SurCorea"],
  ["Riquelme Presidente", "MED", 59, "Argentina"],
  ["Fernanfloo", "DEL", 41, "Salvador"],
  ["Cruyff Muerto", "MED", 28, "Países Bajos"],
  // --- Troll agregados ---
  ["Shodri", "DEF", 30, "España"],
  ["Gorgi", "DEL", 99, "Inglaterra"],
  ["Elber Galarga", "MED", 67, "Argentina"],
  ["Grand Phiton", "DEL", 34, "Inglaterra"],
  ["Elsa Pito", "DEF", 57, "Estados Unidos"],
  ["Larry kapija", "DEF", 70, "Inglaterra"],
  ["Abraham melanus", "DEL", 49, "India"],
  ["Casimiro Lateta", "MED", 71, "Francia"],
  ["Dolores Delano", "MED", 34, "Brasil"],          // posición y país al azar
  ["Rosa Melcacho", "MED", 56, "Uruguay"],          // media, posición y país al azar
  ["Solomeo Paredes", "DEL", 63, "Colombia"],       // media, posición y país al azar
  ["Rosamel Fierro", "POR", 48, "Portugal"],        // media, posición y país al azar
  ["Icela Creyo", "POR", 52, "Italia"],             // media, posición y país al azar
  ["Paco Jones", "DEF", 39, "España"],
  ["Alma Madero", "DEF", 44, "Países Bajos"],       // media, posición y país al azar
  ["Quepe Lotudo", "DEL", 60, "Inglaterra"],
  ["Kerry Copito", "POR", 61, "Alemania"],          // media, posición y país al azar
  ["Elva Ginon", "DEL", 31, "Argentina"],
  ["Marisa Caleche", "DEL", 21, "España"],
  ["Juanpi Torrico", "DEF", 32, "Argentina"],
  ["Leandro Walls", "MED", 87, "Argentina"],
  ["Lautaro White", "DEF", 79, "Argentina"],
  ["Brayano", "DEF", 30, "Argentina"]
];
const ALL_RAW = RAW_PLAYERS.concat(ARG_BRA_PLAYERS.map(p=>p.slice(0,3))).concat(EXTRA_PLAYERS.map(p=>p.slice(0,3))).concat(TROLL_PLAYERS);
/* Los últimos 10 de RAW_PLAYERS son los troll clásicos (sin país propio) */
const RAW_TROLL_NAMES = new Set(RAW_PLAYERS.slice(-10).map(p=>p[0]));
const PLAYERS = ALL_RAW.map((p,i)=>{
  const info=PLAYER_INFO[p[0]];
  const troll = p.length>3; // jugador troll: trae su propio país
  const country = troll ? p[3] : (info ? info.country : "Argentina");
  const club = troll ? "Troll FC" : (info ? info.club : "Liga Profesional");
  return {id:i, name:p[0], pos:p[1], ovrBase:p[2], ovr:p[2], country, club, troll, trollish: troll || RAW_TROLL_NAMES.has(p[0])};
});
/* Bandera del país del jugador (pujas y modo reloj). Imagen de flagcdn; si no carga (sin internet), cae al emoji de bandera. */
const COUNTRY_CODES = {"Argentina":"ar","Brasil":"br","España":"es","Italia":"it","Francia":"fr","Inglaterra":"gb-eng","Países Bajos":"nl","Alemania":"de","Portugal":"pt","Uruguay":"uy","Colombia":"co","Noruega":"no","Chile":"cl","Bélgica":"be","Unión Soviética":"su","Suecia":"se","Senegal":"sn","Polonia":"pl","Nigeria":"ng","Marruecos":"ma","Irlanda":"ie","Irlanda del Norte":"gb-nir","Hungría":"hu","Eslovenia":"si","Egipto":"eg","Dinamarca":"dk","Croacia":"hr","Costa de Marfil":"ci","Costa Rica":"cr","Chequia":"cz","Canadá":"ca","Camerún":"cm","Bulgaria":"bg","Austria":"at"};
function countryFlagEmoji(code){
  if(!code) return "🚩";
  if(code==="gb-eng") return String.fromCodePoint(0x1F3F4,0xE0067,0xE0062,0xE0065,0xE006E,0xE0067,0xE007F);
  if(code==="gb-nir") return "🇬🇧";
  if(code==="su") return "🚩";
  return code.toUpperCase().split("").map(c=>String.fromCodePoint(0x1F1E6+c.charCodeAt(0)-65)).join("");
}
function countryFlag(country){
  const code=COUNTRY_CODES[country];
  const em=countryFlagEmoji(code);
  if(!code) return em;
  return `<img class="cflag" src="https://flagcdn.com/w80/${code}.png" alt="${country}" onerror="this.replaceWith(document.createTextNode('${em}'))">`;
}
const MIN_PRICE=20; // precio mínimo de salida en la puja (M)
function fmtM(n){ return n+"M"; } // los precios se muestran en millones (ej: 20M)
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randomizePlayerValues(){
  // "Valor aleatorio": cada partida los jugadores arrancan con una media distinta a su base histórica
  PLAYERS.forEach(p=>{ p.ovr = p.troll ? p.ovrBase : Math.max(30, Math.min(99, p.ovrBase + randInt(-10,10))); });
}

const TEAM_COLORS = ["#35d17c","#5b8def","#f0b90b","#e5484d","#a78bfa","#22d3ee","#fb923c","#f472b6","#84cc16","#38bdf8","#f97316","#c084fc","#2dd4bf","#eab308","#f87171","#818cf8"];
