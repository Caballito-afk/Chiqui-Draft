/* =========================================================
   ESTADO
========================================================= */
let state = {
  game:"puja", // puja | random | reloj (minijuego)
  mode:"ia", // ia | local
  comp:"leaguecup", // league | cup | leaguecup ("Copa de la liga")
  doubleLeg:false, // ida y vuelta (en Copa de la liga: solo la fase eliminatoria)
  leagueDouble:false, // solo Copa de la liga: la fase de liga también a doble vuelta
  finalDouble:false, // la final a ida y vuelta (opción aparte, independiente de doubleLeg / leagueDouble)
  useMarket:false, // mercado de pases antes del torneo (por defecto: sin mercado)
  botLevel:"regular", // dificultad de los bots (solo Puja, El Reloj y Mercado): facil | regular | dificil
  botOffers:true, // con bots + mercado: los bots pueden ofertar por tus jugadores
  trollMode:"off", // jugadores troll: on (con troll) | off (sin troll) | only (solo troll)
  useFreeMarket:true, // dentro del mercado: pestaña "Mercado libre" (jugadores que no salieron en la puja)
  playMode:"all", // eliminatorias: all (todos a la vez) | one (uno por uno)
  numTeams:6,
  bidSecs:10, // Puja: segundos por puja / por turno
  skipUses:null, // Un jugador (Puja y El Reloj): veces que se puede usar "Pasar x10". null = infinitas, 0 = ninguna
  passLimit:null, // Puja multijugador: veces que cada equipo puede plantarse (saltear) en toda la subasta. null = infinitas, 0 = ninguna
  clockSecs:8, // El Reloj: segundos que tarda el precio en bajar
  startBudget:1000, // presupuesto inicial por equipo (en M)
  squadSize:11, // 11 (Fútbol 11) | 5 (Fútbol 5)
  teams:[], // {id,name,color,isHuman,roster:[playerIds],budget}
  auction:null,
  mini:null, // estado del minijuego El Reloj
  fixture:[], // array of matchdays -> array of matches
  currentMd:0,
  standings:{}, // teamId -> stats
  scorers:{}, // playerId -> {goals, assists, cs, extra}
  statsView:"goals", // tabla de jugadores: goals | assists
  playoffs:null,
  champions:false, // modo Champions/Libertadores: fase de grupos de 4 + eliminatorias (internamente comp="leaguecup")
  groups:null, // [[teamId,...],...]
  awayGoals:false, // regla del gol de visitante (ida y vuelta)
  champET:true // true: prórroga + penales; false: directo a penales
};
