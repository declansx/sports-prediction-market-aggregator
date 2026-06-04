"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// serverless/markets.ts
var markets_exports = {};
__export(markets_exports, {
  default: () => handler
});
module.exports = __toCommonJS(markets_exports);

// ../bot/src/config.ts
var import_zod = require("zod");
var import_dotenv = __toESM(require("dotenv"));
import_dotenv.default.config();
var readOnlyMode = process.env.READ_ONLY_MODE === "true";
var requiredUnlessReadOnly = (msg) => readOnlyMode ? import_zod.z.string().optional() : import_zod.z.string().min(1, msg);
var envSchema = import_zod.z.object({
  NODE_ENV: import_zod.z.enum(["development", "production", "test"]).default("development"),
  READ_ONLY_MODE: import_zod.z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  PORT: import_zod.z.string().default("3001"),
  DATABASE_URL: import_zod.z.string().min(1, "DATABASE_URL is required"),
  TELEGRAM_BOT_TOKEN: import_zod.z.string().optional(),
  TELEGRAM_AUTHORIZED_CHAT_ID: import_zod.z.string().optional(),
  SX_BET_API_URL: import_zod.z.string().url().default("https://api.sx.bet"),
  SX_BET_API_KEY: import_zod.z.string().min(1, "SX_BET_API_KEY is required for real-time Centrifugo connection"),
  SX_BET_WS_URL: import_zod.z.string().url().default("wss://realtime.sx.bet/connection/websocket"),
  POLYMARKET_API_URL: import_zod.z.string().url().default("https://clob.polymarket.com"),
  POLYMARKET_FUNDER_ADDRESS: requiredUnlessReadOnly("POLYMARKET_FUNDER_ADDRESS is required \u2014 proxy wallet address from polymarket.com/settings"),
  POLYMARKET_API_KEY: requiredUnlessReadOnly("POLYMARKET_API_KEY is required"),
  POLYMARKET_SECRET: requiredUnlessReadOnly("POLYMARKET_SECRET is required"),
  POLYMARKET_PASSPHRASE: requiredUnlessReadOnly("POLYMARKET_PASSPHRASE is required"),
  POLYMARKET_PRIVATE_KEY: requiredUnlessReadOnly("POLYMARKET_PRIVATE_KEY is required"),
  SX_PRIVATE_KEY: requiredUnlessReadOnly("SX_PRIVATE_KEY is required"),
  POLYGON_RPC_URL: import_zod.z.string().url().default("https://polygon-rpc.com"),
  SX_NETWORK_RPC_URL: import_zod.z.string().url().default("https://rpc-rollup.sx.technology"),
  LOG_LEVEL: import_zod.z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PUBLIC_PORT: import_zod.z.string().optional()
});
var parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`[config] Missing or invalid environment variables:
${missing}`);
  process.exit(1);
}
var config = parsed.data;

// ../bot/src/adapters/teamNamesGenerated.ts
var GENERATED_CANONICAL = {
  // --- UCL ---
  "rangers fc": "Glasgow Rangers",
  "nk celje": "NK CM Celje",
  "bologna fc 1909": "Bologna",
  "ssc napoli": "Napoli",
  "leicester city fc": "Leicester City",
  "lille osc": "Lille",
  "sport lisboa e benfica": "Benfica",
  "sporting cp": "Sporting CP",
  "ss lazio": "Lazio",
  "servette fc": "Servette FC",
  "manchester city fc": "Manchester City",
  "fk borac banja luka": "Borac Banja Luka",
  "as roma": "AS Roma",
  "mh maccabi tel aviv": "Maccabi Tel Aviv",
  "chelsea fc": "Chelsea",
  "newcastle united fc": "Newcastle United",
  "gnk dinamo zagreb": "Dinamo Zagreb",
  "tottenham hotspur fc": "Tottenham Hotspur",
  "villarreal cf": "Villarreal",
  "bayer 04 leverkusen": "Bayer 04 Leverkusen",
  "liverpool fc": "Liverpool",
  "ac milan": "AC Milan",
  "atalanta bc": "Atalanta",
  "feyenoord rotterdam": "Feyenoord",
  "bv borussia 09 dortmund": "Borussia Dortmund",
  "eintracht frankfurt": "Eintracht Frankfurt",
  "legia warszawa": "Legia Warszawa",
  "tsg 1899 hoffenheim": "TSG 1899 Hoffenheim",
  "fc bayern m\xFCnchen": "FC Bayern Munich",
  "olympique de marseille": "Olympique Marseille",
  "rsc anderlecht": "RSC Anderlecht",
  "shamrock rovers fc": "Shamrock Rovers",
  "\u0161k slovan bratislava": "SK Slovan Bratislava",
  "sk puntigamer sturm graz": "SK Puntigamer Sturm Graz",
  "sc braga": "Sporting Braga",
  "v\xEDkingur": "V\xEDkingur Reykjav\xEDk",
  "ogc nice": "Nice",
  "vfb stuttgart": "VfB Stuttgart",
  "vfl wolfsburg": "VfL Wolfsburg",
  "rb leipzig": "RB Leipzig",
  "sk slavia praha": "SK Slavia Praha",
  "fc lugano": "FC Lugano",
  "afc ajax": "Ajax Amsterdam",
  "girona fc": "Girona",
  "1. fc union berlin": "Union Berlin",
  "stade brestois 29": "Stade Brestois (Brest)",
  "racing club de lens": "Lens",
  "fc midtjylland": "FC Midtjylland",
  "fc porto": "FC Porto",
  "fc red bull salzburg": "FC Red Bull Salzburg",
  "fcsb": "FCSB",
  "galatasaray sk": "Galatasaray",
  "ac sparta praha": "AC Sparta Praha",
  "juventus fc": "Juventus",
  "as monaco fc": "AS Monaco FC",
  "kaa gent": "KAA Gent",
  "molde fk": "Molde",
  "bsc young boys": "BSC Young Boys",
  "paris saint-germain fc": "Paris Saint Germain",
  "psv": "PSV Eindhoven",
  "real madrid cf": "Real Madrid",
  "sevilla fc": "Sevilla",
  "sk rapid wien": "SK Rapid Wien",
  "club brugge kv": "Club Brugge KV",
  "valencia cf": "Valencia",
  "fc barcelona": "Barcelona FC",
  "fc basel 1893": "FC Basel",
  "fk shakhtar donetsk": "FC Shakhtar Donetsk",
  "aston villa fc": "Aston Villa",
  "fk crvena zvezda": "Crvena Zvezda",
  "arsenal fc": "Arsenal",
  "manchester united fc": "Manchester United",
  "fk dynamo kyiv": "FC Dynamo Kyiv",
  "celtic fc": "Celtic",
  "az": "AZ Alkmaar",
  "fc twente '65": "FC Twente",
  "fenerbah\xE7e sk": "Fenerbah\xE7e",
  "paok": "PAOK",
  "real sociedad de f\xFAtbol": "Real Sociedad",
  "nk olimpija ljubljana": "Olimpija Ljubljana",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fc drita": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "fc internazionale milano": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "fc cfr 1907 cluj": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "fc københavn": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "fc zürich": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "fc petrocub hînceşti": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "fc shkupi": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "fcv farul constanţa": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "apóel": "Arsenal",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fc flora": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "fc schalke 04": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fc viitorul constanţa": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fci tallinn": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "fc feronikeli 74": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "fc prishtina": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.81)] verify before uncommenting:
  // "fc ballkani": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "atlétic club d'escaldes": "Atletico Madrid",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "fc santa coloma": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "as trenčín": "Arsenal",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "fc milsami orhei": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "fc déifferdeng 03": "FC Bayern Munich",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "athletic club": "Atletico Madrid",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fehérvár fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "rams başakşehir fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "brøndby if": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "rks raków częstochowa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "umf stjarnan": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "trabzonspor": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sp la fiorita": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "hšk zrinjski mostar": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "rīga fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk dynama-brest": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "urartu fa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf egnatia rrogozhinë": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk vardar skopje": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk zenit": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "the new saints fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ru saint-gilloise": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "inter club d'escaldes": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ararat-armenia fa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "helsingin jk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk panevėžys": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "b36": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "pyunik fa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "aek lárnakas": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "as omónoia leukosías": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "beşiktaş jk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "europa fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "f91 diddeleng": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fc sheriff tiraspol": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fc spartak trnava": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fh hafnarfjörður": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "hb": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "hnk rijeka": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "borussia mönchengladbach": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk kukësi": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "jagiellonia białystok": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf shkëndija 79": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf víkingur": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "linfield fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "mšk žilina": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "nk lokomotiva zagreb": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cs fola esch": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "nõmme kalju fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "rosenborg bk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "seinäjoen jk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "valletta fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "stade rennais fc 1901": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk rostov": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk spartak moskva": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sp tre penne": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "bk häcken": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "umf breiðablik": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk sūduva marijampolė": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "connah's quay nomads fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "gks piast gliwice": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ifk mariehamn": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf teuta durrës": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf valur": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "krc genk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "mh maccabi haifa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "aek": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk sileks": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ue santa coloma": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "budapest honvéd fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf trepça '89 mitrovicë": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "dundalk fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sk torpedo kutaisi": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "floriana fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sk brann": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "djurgårdens if ff": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "tobyl fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kuopion ps": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "lask linz": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "tre fiori fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sk iberia 1999": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk rīgas futbola skola": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "royal antwerp fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk bodø/glimt": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk ventspils": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "noah fa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk tsc bačka topola": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "valmiera fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ħamrun spartans fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sk dnipro-1": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "áris lemesoú": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fci levadia": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fc struga trim & lum": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fc swift hesper": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "larne fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ac virtus": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk dečić tuzi": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fc viktoria plzeň": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk žalgiris vilnius": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "astana fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ss folgore/falciano": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "hibernians fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf skënderbeu korçë": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kks lech poznań": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "lincoln red imps fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "neftçi pfk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "malmö ff": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "nš mura": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "nk maribor": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "olympique lyonnais": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "olympiakós sfp": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "panathinaikós ao": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "pfk cska moskva": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "pfk ludogorets 1945 razgrad": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "crusaders fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sk dila gori": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk rudar pljevlja": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "qarabağ ağdam fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kr reykjavík": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk partizan beograd": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk sarajevo": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ferencvárosi tc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk budućnost podgorica": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk dynama-minsk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "qairat fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk krasnodar": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk lokomotiv moskva": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ofk titograd": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ordabasy fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk partizani": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk šachcior salihorsk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk spartaks jūrmala": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk sutjeska nikšić": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "mh hapoel be'er sheva": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "club atlético de madrid": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cork city fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "royal standard de liège": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk bate barysaŭ": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "afc astra giurgiu": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "aik fotboll": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "alashkert fa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "apóllon lemesoú": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sk dinamo batumi": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sk dinamo tbilisi": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sk samtredia": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf tirana": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kí": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "páfos fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "shelbourne fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk liepāja": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ifk norrköping fk": "",
  // --- UEL ---
  "1. fsv mainz 05": "FSV Mainz",
  "fk austria wien": "Austria",
  "everton fc": "Everton",
  "borussia m\xF6nchengladbach": "Borussia Monchengladbach",
  "southampton fc": "Southampton",
  "p\xE1fos fc": "Pafos FC",
  "olympique lyonnais": "Olympique Marseille",
  "athletic club": "Athletic Bilbao",
  "fc utrecht": "FC Utrecht",
  "paksi fc": "Pafos FC",
  "fc augsburg": "FC Augsburg",
  "fc st. gallen": "FC St. Gallen",
  "malm\xF6 ff": "Malmo FF",
  "pfk ludogorets 1945 razgrad": "PFC Ludogorets 1945 Razgrad",
  "panathinaik\xF3s ao": "Panathinaikos",
  "stade rennais fc 1901": "Stade Reims",
  "willem ii tilburg": "Willem II Tilburg",
  "ferencv\xE1rosi tc": "Ferencvaros",
  "olympiak\xF3s sfp": "Olympiakos Piraeus",
  "jagiellonia bia\u0142ystok": "Jagiellonia Bialystok",
  "fc viktoria plze\u0148": "FC Viktoria Plzen",
  "rc strasbourg alsace": "Strasbourg",
  "cercle brugge ksv": "Cercle Brugge KSV",
  "go ahead eagles": "Go Ahead Eagles",
  "fc arouca": "Arouca",
  "rc celta de vigo": "Celta de Vigo",
  "rcd espanyol de barcelona": "Barcelona FC",
  "real betis balompi\xE9": "Real Betis",
  "fc groningen": "FC Groningen",
  "heracles almelo": "Heracles Almelo",
  "lillestr\xF8m sk": "Lille",
  "stade de reims": "Stade Reims",
  "djurg\xE5rdens if ff": "Djurgardens IF",
  "fc lusitanos": "FC Lugano",
  "fc sion": "FC Sion",
  "fc thun": "FC Twente",
  "sporting du pays de charleroi": "Sporting CP",
  "kr reykjav\xEDk": "V\xEDkingur Reykjav\xEDk",
  "pfk arsenal tula": "Arsenal",
  "if elfsborg": "IF Elfsborg",
  "vit\xF3ria sc": "Vit\xF3ria Guimar\xE3es",
  "fc koper": "FC Kopenhagen",
  "fc zimbru chi\u015Fin\u0103u": "FC Zurich",
  "fc luzern": "FC Luzern",
  "fc b\u0103l\u021Bi": "FC Basel",
  "grasshopper club z\xFCrich": "Grasshopper Club Z\xFCrich",
  "wolverhampton wanderers fc": "Wolverhampton Wanderers",
  "fk bod\xF8/glimt": "Bodo/Glimt",
  "fc nantes": "FC Nantes",
  "cdf benfica": "Benfica",
  "dinamo 1948": "Dinamo Zagreb",
  "fc zl\xEDn": "FC Luzern",
  "djurg\xE5rdsbrunns fc": "Djurgardens IF",
  "fc inter turku": "FC Winterthur",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "vaasan ps": "Las Palmas",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "sarpsborg 08 ff": "Strasbourg",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "us sassuolo calcio": "USA",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "sk dinamo batumi": "SK Slovan Bratislava",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fk šachcior salihorsk": "FC Shakhtar Donetsk",
  // [LOW-CONFIDENCE via jaro-winkler(0.81)] verify before uncommenting:
  // "1. fc köln": "1. FC Heidenheim 1846",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "urartu fa": "Urawa",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "fc cfr 1907 cluj": "FC Aarau",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "aik fotboll": "Riga Football School",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "puskás akadémia fc": "USA",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "fehérvár fc": "Forge FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "randers fc": "RSC Anderlecht",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "ararat-armenia fa": "Armenia",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "sp la fiorita": "Spain",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "cs fola esch": "FC Den Bosch",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "sk dila gori": "SK Rapid Wien",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "fc vaduz": "FC Aarau",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "fk dynama-brest": "FC Dallas",
  // [LOW-CONFIDENCE via jaro-winkler(0.83)] verify before uncommenting:
  // "fc baník ostrava": "FC Basel",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "as trenčín": "AS Roma",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "fci levadia": "FC Basel",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "as omónoia leukosías": "AS Roma",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "fk vardar brvenica": "FC Cartagena",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "fk oleksandriya": "Poland",
  // [LOW-CONFIDENCE via jaro-winkler(0.79)] verify before uncommenting:
  // "fc milsami orhei": "FC Midtjylland",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "fk partizan beograd": "FC Cartagena",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "sk iberia 1999": "SK Rapid Wien",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "samsunspor": "Osasuna",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "fk vardar skopje": "FC Shakhtar Donetsk",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "crusaders fc": "Cruzeiro",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "silkeborg if": "San Diego FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "astana fk": "Austin FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "nk maribor": "NK CM Celje",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "lincoln red imps fc": "Lille",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "heart of midlothian fc": "Inter Milan",
  // [LOW-CONFIDENCE via jaro-winkler(0.85)] verify before uncommenting:
  // "qarabağ ağdam fk": "Qarabag",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "fc santa coloma": "FC Sion",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "granada cf": "Canada",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "rz pellets wolfsberger ac": "SV Elversberg",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "hibernians fc": "Cibao FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "sk dnipro-1": "SK Slavia Praha",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "fk rostov": "FC Porto",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "birkirkara fc": "Birmingham City",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "fk bate barysaŭ": "FC Nantes",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "aberdeen fc": "Servette FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "fc corvinul 1921 hunedoara": "FC Zurich",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "fk zenit": "FC Twente",
  // [LOW-CONFIDENCE via jaro-winkler(0.81)] verify before uncommenting:
  // "beşiktaş jk": "Besiktas",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "ss folgore/falciano": "Forge FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "shelbourne fc": "Sheffield United FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "tre fiori fc": "Forge FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "fk partizani": "FC Cartagena",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fk mladost lučani": "FC Dallas",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "fk rīga": "FC Lugano",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "rc gent": "KAA Gent",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "fc flora": "FC Porto",
  // [LOW-CONFIDENCE via jaro-winkler(0.79)] verify before uncommenting:
  // "as saint-étienne": "Saint-Etienne",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "fc sheriff tiraspol": "FC St. Pauli",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "qairat fk": "Qarabag",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "fk haugesund": "FC Augsburg",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "sp tre penne": "Saint-Etienne",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "fk panevėžys": "France",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "konyaspor": "Kosovo",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "ac juvenes/dogana": "AC Sparta Praha",
  // [LOW-CONFIDENCE via jaro-winkler(0.83)] verify before uncommenting:
  // "fc spartak trnava": "FC Shakhtar Donetsk",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "afc astra giurgiu": "AFC Bournemouth",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "alashkert fa": "Almere City FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "balzan fc": "Barcelona FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "b": "Bahia",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "cork city fc": "Almere City FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "fc progrès niederkorn": "FC Groningen",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "fc dacia chişinău": "FC Dallas",
  // [LOW-CONFIDENCE via jaro-winkler(0.81)] verify before uncommenting:
  // "fc girondins de bordeaux": "FC Groningen",
  // [LOW-CONFIDENCE via jaro-winkler(0.84)] verify before uncommenting:
  // "fc lahti": "FC Lugano",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "seinäjoen jk": "PSV Eindhoven",
  // [LOW-CONFIDENCE via jaro-winkler(0.84)] verify before uncommenting:
  // "fc botoşani": "FC Porto",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "fc saxan gagauz yeri": "FC Aarau",
  // [LOW-CONFIDENCE via jaro-winkler(0.84)] verify before uncommenting:
  // "fc slovan liberec": "FC Sion",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "sk tskhinvali": "SK Slovan Bratislava",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "fh hafnarfjörður": "FC Aarau",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fk mladá boleslav": "FC Dallas",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "fk dnipro": "FC Porto",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "fk jablonec": "FC Nantes",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "fk jelgava": "FC Lugano",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "fk rabotnichki skopje": "FC Viktoria Plzen",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "fk riteriai": "Fiorentina",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fk zorya luhansk": "FC Dallas",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "apóllon lemesoú": "APOEL Nicosia",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "linfield fc": "Lille",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "sivasspor": "Mirassol",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "glenavon fc": "Genoa",
  // [LOW-CONFIDENCE via jaro-winkler(0.83)] verify before uncommenting:
  // "glentoran fc": "Genoa",
  // [LOW-CONFIDENCE via jaro-winkler(0.84)] verify before uncommenting:
  // "ifk göteborg": "IF Elfsborg",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "inverness caledonian thistle fc": "Inter Miami CF",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "jk sillamäe kalev": "Villarreal",
  // [LOW-CONFIDENCE via jaro-winkler(0.83)] verify before uncommenting:
  // "racing fc union lëtzebuerg": "Racing Santander",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "newtown afc": "Newcastle United",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "nk domžale": "NK CM Celje",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "nk lokomotiva zagreb": "Dinamo Zagreb",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "aps atrómitos athinón": "AS Roma",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "pfk beroe stara zagora": "PFC Ludogorets 1945 Razgrad",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "fk lovech": "FC Dordrecht",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "royal standard de liège": "Real Esteli",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "sc rheindorf altach": "SC Internacional",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "shirak fa": "Shamrock Rovers",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "skonto fc rīga": "Santos FC SP",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "st johnstone fc": "Toronto FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "fc déifferdeng 03": "FC Luzern",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "ue sant julià": "USA",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "strømsgodset if": "Strasbourg",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "ulisses fc": "Fluminense FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "university college dublin fc": "Union Berlin",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "cliftonville fc": "Charlton Athletic",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "ue santa coloma": "USA",
  // [LOW-CONFIDENCE via jaro-winkler(0.79)] verify before uncommenting:
  // "valletta fc": "Valladolid",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "fk ufa": "FC Lugano",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "ifk norrköping fk": "IF Elfsborg",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "as la jeunesse d'esch": "Alajuelense",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "csm politehnica iași": "Celtic",
  // [LOW-CONFIDENCE via jaro-winkler(0.79)] verify before uncommenting:
  // "fc flyeralarm admira": "FC Aarau",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "sk chikhura sachkhere": "SK Slavia Praha",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "sk samtredia": "SK Slavia Praha",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "fc viitorul constanţa": "FC Viktoria Plzen",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "hang sai sc": "Angers SC",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "fk radnik bijeljina": "France",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "ifk mariehamn": "FSV Mainz",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "fk spartak moskva": "FC Porto",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "mh beitar jerusalem": "Manchester United",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "hibernian fc": "Cibao FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "aek": "PAOK",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "pfk cherno more varna": "Como",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "connah's quay nomads fc": "Corinthians SP",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "kf valur": "FC Luzern",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "llandudno fc": "Orlando City",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "mks cracovia": "Croatia",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "nd gorica": "Georgia",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "nk široki brijeg": "NK CM Celje",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "pas giánnina": "Pumas UNAM",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "pfk slavia sofia": "Latvia",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "rovaniemen ps": "Romania",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "fci tallinn": "FC St. Gallen",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "budapest honvéd fc": "AS Monaco FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "ae lemesoú": "Stade Reims",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "ballymena united fc": "Barcelona FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.81)] verify before uncommenting:
  // "bangor city fc": "Almere City FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "mk bnei yehuda tel aviv": "Maccabi Tel Aviv",
  // [LOW-CONFIDENCE via jaro-winkler(0.81)] verify before uncommenting:
  // "coleraine fc": "Barcelona FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "cs marítimo": "Costa Rica",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "sk torpedo kutaisi": "SK Rapid Wien",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "ertis fk": "Eintracht Frankfurt",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fk pelister bitola": "Republic of Ireland",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "lyngby bk": "Lyon",
  // [LOW-CONFIDENCE via jaro-winkler(0.79)] verify before uncommenting:
  // "arka gdynia": "Argentina",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "paniónios gss": "Panathinaikos",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "sv zulte-waregem": "SV Werder Bremen",
  // [LOW-CONFIDENCE via jaro-winkler(0.75)] verify before uncommenting:
  // "vasas fc": "Pafos FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "fk sarajevo": "FC Cartagena",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "krc genk": "KAA Gent",
  // [LOW-CONFIDENCE via jaro-winkler(0.81)] verify before uncommenting:
  // "bala town fc": "Barcelona FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "akhisarspor": "Bahia",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "anórthosis ammochóstou": "Angers SC",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "cefn druids afc": "Sheffield United FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "fk mariupol": "FC Aarau",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "gżira united fc": "Austin FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "lask linz": "Las Palmas",
  // [LOW-CONFIDENCE via jaro-winkler(0.79)] verify before uncommenting:
  // "nk rudar velenje": "NK CM Celje",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "ue engordany": "Hungary",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "újpest fc": "Pafos FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "fc feronikeli 74": "FC New York",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "səbail fk": "Brazil",
  // [LOW-CONFIDENCE via jaro-winkler(0.81)] verify before uncommenting:
  // "cardiff metropolitan university fc": "Cardiff City",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "barry town united afc": "Barcelona FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "kilmarnock fc": "Barcelona FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "nš mura": "NAC Breda",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "yeni malatyaspor": "Malta",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "lechia gdańsk": "Lecce",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "motherwell fc": "Monterrey",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "sk lokomotivi tbilisi": "SK Slovan Bratislava",
  // [LOW-CONFIDENCE via jaro-winkler(0.78)] verify before uncommenting:
  // "sc gjilani": "AC Milan",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "hšk zrinjski mostar": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "pyunik fa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk sutjeska nikšić": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "stabæk fotball": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "b36": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ħamrun spartans fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "dundalk fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk dunav ruse": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "pfk cska moskva": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "áris lemesoú": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fredrikstad fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk rudar pljevlja": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk ventspils": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sabah fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf skënderbeu korçë": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk kryvbas kryvyi rih": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "nsí runavík": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk liepāja": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "wks śląsk wrocław": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "wisła kraków": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ilves tampere": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk lokomotiv moskva": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "mh hapoel be'er sheva": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "mk maccabi beer sheva": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cs alliance dudelange": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "the new saints fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sbv vitesse": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk vojvodina novi sad": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "hb": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "hnk rijeka": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "airbus uk broughton fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf shkëndija 79": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "asa 2013 târgu mureș": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "debreceni vsc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "europa fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk atlantas klaipėda": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk kruoja pakruojis": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk kukësi": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ofk titograd": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk olimpik sarajevo": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk spartaks jūrmala": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk čukarički": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "mh hapoel ironi kiryat shmona": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "şamaxı fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf laçi": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf renova djepchishte": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "mtk budapest": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "neftçi pfk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "nõmme kalju fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "odds bk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ags astéras trípolis": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kuopion ps": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "qəbələ i̇k": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "rosenborg bk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "st patrick's athletic fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk vorskla poltava": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "hammarby fotboll": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk kauno žalgiris": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "aek lárnakas": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "mšk žilina": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "f91 diddeleng": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cs pandurii târgu-jiu": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk bokelj kotor": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk sloboda tuzla": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk sūduva marijampolė": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "gks piast gliwice": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk tarpieda-belaz žodzina": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "umf breiðablik": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "bk häcken": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf víkingur": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf llapi": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kf teuta durrës": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kəpəz pfk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sincan belediyesi ankaraspor": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "tj spartak myjava": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kghm zagłębie lubin": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "pfk botev plovdiv": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk olimpik donetsk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk zeta golubovci": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "syunik fa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "kv oostende": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "östersunds fk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "pfk cska sofia": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "akademisk bk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk radnički niš": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk spartak ždrepčeva krv subotica": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk stumbras kaunas": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "górnik zabrze": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "mh hapoel haifa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "íb vestmannaeyja": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "jk narva trans": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ks luftëtari gjirokastër": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ofk grbalj radanovići": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "csf speranţa nisporeni": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "esbjerg fb": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ap brera strumica": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk viciebsk": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "pfk lokomotiv plovdiv": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "yellow-red kv mechelen": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk makedonija gjorche petrov": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "f91 diddeleng u19": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fk iskra danilovgrad": "",
  // --- Copa Libertadores ---
  "ca mineiro": "Atletico Mineiro",
  "santos fc": "Santos FC SP",
  "sc internacional": "SC Internacional",
  "club universitario": "Universitario De Deportes",
  "deportivo t\xE1chira fc": "Deportivo La Guaira",
  "red bull bragantino": "Red Bull Bragantino",
  "cdp curic\xF3 unido": "CDP Junior FC",
  "deportivo pereira": "Deportivo La Guaira",
  "ca cerro": "Cerro Porte\xF1o",
  "ca rosario central": "Rosario Central",
  "club universitario de deportes": "Universitario De Deportes",
  "cruzeiro ec": "Cruzeiro",
  "se palmeiras": "Palmeiras SP",
  "club always ready": "Always Ready",
  "universidad central de venezuela fc": "Venezuela",
  "cs independiente rivadavia": "Independiente Rivadavia",
  "cd coquimbo unido": "Coquimbo Unido",
  "mirassol fc": "Mirassol",
  "ca platense": "Platense",
  "everton de vi\xF1a del mar": "Everton",
  "cd tolima": "Deportes Tolima",
  "barcelona sc": "Barcelona FC",
  "club blooming": "Club Bolivar",
  "ca boca juniors": "Boca Juniors",
  "ca independiente": "Independiente Medell\xEDn",
  "ca lan\xFAs": "Lan\xFAs",
  "ca river plate": "Club Atletico River Plate Argentina",
  "cr vasco da gama": "CR Vasco da Gama",
  "ec bahia": "Bahia",
  "club libertad": "Libertad Asuncion",
  "club olimpia": "Club Bolivar",
  "cs cristal": "Sporting Cristal",
  "cf universidad de chile": "Chile",
  "club bol\xEDvar": "Club Bolivar",
  "club cerro porte\xF1o": "Cerro Porte\xF1o",
  "club nacional": "Nacional Madeira",
  "estudiantes de m\xE9rida fc": "Estudiantes de La Plata",
  "deportivo la guaira fc": "Deportivo La Guaira",
  "deportivo binacional fc": "Deportivo La Guaira",
  "fortaleza ec": "Fortaleza",
  "cusco fc": "Cusco",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "montevideo wanderers fc": "Universitario De Deportes",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "botafogo fr": "Boca Juniors",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "cd oriente petrolero": "Cruzeiro Esporte Clube",
  // [LOW-CONFIDENCE via jaro-winkler(0.85)] verify before uncommenting:
  // "club plaza colonia": "Club Nacional de Football",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "cd magallanes": "CR Flamengo",
  // [LOW-CONFIDENCE via jaro-winkler(0.84)] verify before uncommenting:
  // "club aurora": "Club Bolivar",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "cd lara": "CDP Junior FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "millonarios fc": "Mirassol",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "csd colo-colo": "Cusco",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "cd universidad césar vallejo": "CDP Junior FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.73)] verify before uncommenting:
  // "sc corinthians paulista": "Corinthians SP",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "club independiente petrolero": "Club Nacional de Football",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "zulia fc": "UCV FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.70)] verify before uncommenting:
  // "ca boston river": "Barcelona Sporting Club",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "cd palestino": "CR Flamengo",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "cd universidad católica": "CDP Junior FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "cd universidad de concepción": "CDP Junior FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.83)] verify before uncommenting:
  // "club guaraní": "Club Bolivar",
  // [LOW-CONFIDENCE via jaro-winkler(0.83)] verify before uncommenting:
  // "club jorge wilstermann": "Club Bolivar",
  // [LOW-CONFIDENCE via jaro-winkler(0.77)] verify before uncommenting:
  // "club the strongest": "Club Bolivar",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "club alianza lima": "Club Nacional de Football",
  // [LOW-CONFIDENCE via jaro-winkler(0.76)] verify before uncommenting:
  // "ca nacional potosí": "Club Nacional de Football",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "danubio fc": "CDP Junior FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.80)] verify before uncommenting:
  // "club san josé": "Club Bolivar",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "cd unión la calera": "CDP Junior FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.81)] verify before uncommenting:
  // "cerro largo fc": "Cerro Porteño",
  // [LOW-CONFIDENCE via jaro-winkler(0.71)] verify before uncommenting:
  // "cd huachipato": "CDP Junior FC",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "ayacucho fc": "Cusco",
  // [LOW-CONFIDENCE via jaro-winkler(0.79)] verify before uncommenting:
  // "sport boys warnes": "Sporting Cristal",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "o'higgins fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cs 2 de mayo": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "grêmio fbpa": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "csyd defensa y justicia": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "racing club": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "américa fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca paranaense": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "são paulo fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "fbc melgar": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "unión española": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cd cobresal": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "montevideo city torque": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca rentistas": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cd maldonado": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca bucaramanga": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cs trinidense": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "portuguesa fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cd san antonio bulo bulo": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "academia puerto cabello": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "metropolitanos fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca san lorenzo de almagro": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cd godoy cruz antonio tomba": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cs emelec": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca juventud": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cc deportivo municipal": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cd ñublense": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "associação chapecoense de futebol": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca tigre": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca tucumán": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca vélez sarsfield": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cd capiatá": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "caracas fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ad cali": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cs huancayo": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "csyd macará": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "delfín sc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cd el nacional": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "aa argentinos juniors": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca banfield": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca colón": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca huracán": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca patronato": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca talleres": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca peñarol": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "carabobo fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cd iquique": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "atlético nacional": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "zamora fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "defensor sc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ldu de quito": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "águilas doradas rionegro": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca independiente de neuquén": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "cd santiago wanderers": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "américa de cali": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "audax cs italiano": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "royal parí fc": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca central córdoba": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "ca progreso": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sd aucas": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "monagas sc": "",
  // --- La Liga ---
  "las palmas": "Las Palmas",
  "deportivo alav\xE9s": "Deportivo Alaves",
  "valladolid": "Valladolid",
  "rcd mallorca": "Mallorca",
  "levante ud": "Levante",
  "elche cf": "Elche",
  "rayo vallecano de madrid": "Rayo Vallecano",
  "ca osasuna": "Osasuna",
  "getafe cf": "Getafe",
  // [LOW-CONFIDENCE via jaro-winkler(0.85)] verify before uncommenting:
  // "leganes": "Levante",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "club atlético de madrid": "",
  // --- Serie A ---
  "venezia": "Venezia",
  "empoli": "Empoli",
  "monza": "AC Monza Brianza",
  "udinese calcio": "Udinese",
  "acf fiorentina": "Fiorentina",
  "cagliari calcio": "Cagliari",
  "como 1907": "Como",
  "genoa cfc": "Genoa",
  "hellas verona fc": "Hellas Verona",
  "parma calcio 1913": "Parma",
  "pisa sc": "Pisa",
  "torino fc": "Torino",
  "us lecce": "Lecce",
  "us sassuolo calcio": "Sassuolo Calcio",
  // [LOW-CONFIDENCE via jaro-winkler(0.72)] verify before uncommenting:
  // "fc internazionale milano": "Fiorentina",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "us cremonese": "",
  // --- Bundesliga ---
  "holstein kiel": "Holstein Kiel",
  "sc freiburg": "Sport-Club Freiburg",
  "fc st. pauli 1910": "FC St. Pauli",
  "1. fc k\xF6ln": "1. FC Koln",
  "vfl bochum": "VfL Bochum 1848",
  // --- Eredivisie ---
  "vbv de graafschap": "De Graafschap",
  "rkc waalwijk": "RKC Waalwijk",
  "almere city fc": "Almere City FC",
  "ado den haag": "ADO Den Haag",
  "sparta rotterdam": "Sparta Rotterdam",
  "telstar 1963": "SC Telstar",
  "nec": "NEC Nijmegen",
  // [LOW-CONFIDENCE via jaro-winkler(0.82)] verify before uncommenting:
  // "fc emmen": "FC Twente",
  // [LOW-CONFIDENCE via jaro-winkler(0.74)] verify before uncommenting:
  // "sc cambuur-leeuwarden": "SC Heerenveen",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sbv vitesse": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "roda jc kerkrade": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "sbv excelsior": "",
  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:
  // "vvv venlo": "",
  // --- Ligue 1 ---
  "aj auxerre": "Auxerre",
  "angers sco": "Angers SC",
  "fc lorient": "Lorient",
  "fc metz": "Metz",
  "le havre ac": "Le Havre",
  "toulouse fc": "Toulouse"
};

// ../bot/src/adapters/teamNames.ts
var MANUAL = {
  "arsenal": "Arsenal",
  "arsenal fc": "Arsenal",
  "aston villa": "Aston Villa",
  "aston villa fc": "Aston Villa",
  "afc bournemouth": "Bournemouth",
  "bournemouth": "Bournemouth",
  "bournemouth fc": "Bournemouth",
  "brentford": "Brentford",
  "brentford fc": "Brentford",
  "brighton": "Brighton",
  "brighton & hove albion": "Brighton",
  "brighton and hove albion": "Brighton",
  "brighton & hove albion fc": "Brighton",
  "chelsea": "Chelsea",
  "chelsea fc": "Chelsea",
  "crystal palace": "Crystal Palace",
  "crystal palace fc": "Crystal Palace",
  "everton": "Everton",
  "everton fc": "Everton",
  "fulham": "Fulham",
  "fulham fc": "Fulham",
  "ipswich": "Ipswich",
  "ipswich town": "Ipswich",
  "ipswich town fc": "Ipswich",
  "leeds": "Leeds United",
  "leeds united": "Leeds United",
  "leeds united fc": "Leeds United",
  "leicester": "Leicester",
  "leicester city": "Leicester",
  "leicester city fc": "Leicester",
  "liverpool": "Liverpool",
  "liverpool fc": "Liverpool",
  "man city": "Manchester City",
  "manchester city": "Manchester City",
  "manchester city fc": "Manchester City",
  "man united": "Manchester United",
  "man utd": "Manchester United",
  "manchester united": "Manchester United",
  "manchester united fc": "Manchester United",
  "newcastle": "Newcastle",
  "newcastle united": "Newcastle",
  "newcastle united fc": "Newcastle",
  "nottingham forest": "Nottingham Forest",
  "nottingham forest fc": "Nottingham Forest",
  "nott'm forest": "Nottingham Forest",
  "nottm forest": "Nottingham Forest",
  "southampton": "Southampton",
  "southampton fc": "Southampton",
  "tottenham": "Tottenham",
  "tottenham hotspur": "Tottenham",
  "tottenham hotspur fc": "Tottenham",
  // 'spurs' is ambiguous (Tottenham Hotspur vs San Antonio Spurs) — map to NBA team
  // since Tottenham is already covered by the three entries above
  "spurs": "San Antonio Spurs",
  "san antonio spurs": "San Antonio Spurs",
  "west ham": "West Ham",
  "west ham united": "West Ham",
  "west ham united fc": "West Ham",
  "wolves": "Wolverhampton",
  "wolverhampton": "Wolverhampton",
  "wolverhampton wanderers": "Wolverhampton",
  "wolverhampton wanderers fc": "Wolverhampton",
  // UCL clubs
  "ac milan": "AC Milan",
  "ac milan fc": "AC Milan",
  "ajax": "Ajax",
  "afc ajax": "Ajax",
  "ajax amsterdam": "Ajax",
  "atletico madrid": "Atletico Madrid",
  "atletico de madrid": "Atletico Madrid",
  "club atletico de madrid": "Atletico Madrid",
  "club atl\xE9tico de madrid": "Atletico Madrid",
  "atletico": "Atletico Madrid",
  "atletico madrid fc": "Atletico Madrid",
  "barcelona": "Barcelona",
  "fc barcelona": "Barcelona",
  "fc barcelona b": "Barcelona",
  "bayer leverkusen": "Bayer Leverkusen",
  "bayer 04 leverkusen": "Bayer Leverkusen",
  "benfica": "Benfica",
  "sl benfica": "Benfica",
  "borussia dortmund": "Borussia Dortmund",
  "bvb": "Borussia Dortmund",
  "dortmund": "Borussia Dortmund",
  "celtic": "Celtic",
  "celtic fc": "Celtic",
  // 'chelsea' and 'chelsea fc' already in EPL section above
  "club brugge": "Club Brugge",
  "club brugge kv": "Club Brugge",
  "feyenoord": "Feyenoord",
  "galatasaray": "Galatasaray",
  "galatasaray sk": "Galatasaray",
  "inter": "Inter Milan",
  "inter milan": "Inter Milan",
  "fc internazionale": "Inter Milan",
  "fc internazionale milano": "Inter Milan",
  "internazionale": "Inter Milan",
  "juventus": "Juventus",
  "juventus fc": "Juventus",
  "lille": "Lille",
  "losc lille": "Lille",
  // 'manchester city', 'manchester city fc', 'man city' already in EPL section above
  "monaco": "Monaco",
  "as monaco": "Monaco",
  // 'newcastle', 'newcastle united', 'newcastle united fc' already in EPL section above
  "paris saint-germain": "PSG",
  "paris saint germain": "PSG",
  "paris saint-germain fc": "PSG",
  "paris saint germain fc": "PSG",
  "paris saint": "PSG",
  // Polymarket sometimes truncates to "Paris Saint"
  "psg": "PSG",
  "porto": "Porto",
  "fc porto": "Porto",
  "psv": "PSV",
  "psv eindhoven": "PSV",
  "rangers": "Rangers",
  "rangers fc": "Rangers",
  "rb leipzig": "RB Leipzig",
  "rasenballsport leipzig": "RB Leipzig",
  "real madrid": "Real Madrid",
  "real madrid cf": "Real Madrid",
  "red star belgrade": "Red Star Belgrade",
  "crvena zvezda": "Red Star Belgrade",
  "sporting cp": "Sporting CP",
  "sporting clube de portugal": "Sporting CP",
  "sporting clube de portugal cp": "Sporting CP",
  "slovan bratislava": "Slovan Bratislava",
  "sk slovan bratislava": "Slovan Bratislava",
  "stade brestois": "Stade Brestois",
  "stade brestois 29": "Stade Brestois",
  "bayern munich": "Bayern Munich",
  "fc bayern m\xFCnchen": "Bayern Munich",
  "fc bayern munchen": "Bayern Munich",
  "fc bayern munich": "Bayern Munich",
  "bayern m\xFCnchen": "Bayern Munich",
  "bay m\xFCnchen": "Bayern Munich",
  // Copa Libertadores — both platforms use the city-suffixed form; keep it
  "libertad asuncion": "Libertad Asuncion",
  "club libertad": "Libertad Asuncion",
  "olimpia asuncion": "Olimpia Asuncion",
  "club olimpia": "Olimpia Asuncion",
  // Copa Libertadores — SX Bet appends state/region suffix ("SP" = São Paulo state)
  "corinthians sp": "Corinthians",
  "sc corinthians paulista": "Corinthians",
  "corinthians paulista": "Corinthians",
  // stripped form of "SC Corinthians Paulista"
  "palmeiras sp": "Palmeiras",
  // Copa Libertadores — suffixes not in auto-strip (EC, FR, FBPA, SP city codes)
  "cruzeiro esporte clube": "Cruzeiro",
  "cruzeiro ec": "Cruzeiro",
  "botafogo fr": "Botafogo RJ",
  // SX Bet: "Botafogo RJ" (not FR)
  "gr\xEAmio fbpa": "Gremio",
  // SX Bet: "Gremio" (no accent)
  "gremio fbpa": "Gremio",
  "fortaleza ec": "Fortaleza",
  // Copa Libertadores — Brazilian state suffixes (SX Bet appends state code)
  "santos fc": "Santos FC SP",
  "sao paulo fc": "S\xE3o Paulo FC",
  // normalise accent: SX Bet "Sao Paulo FC"
  "s\xE3o paulo fc": "S\xE3o Paulo FC",
  "sao paulo": "S\xE3o Paulo FC",
  "s\xE3o paulo": "S\xE3o Paulo FC",
  // Copa Libertadores — SX Bet uses full club legal name for River Plate
  "club atletico river plate argentina": "River Plate",
  "atletico river plate argentina": "River Plate",
  // Copa Libertadores — CA Mineiro = Atletico Mineiro (SX Bet has no accent)
  "ca mineiro": "Atletico Mineiro",
  "atletico mineiro": "Atletico Mineiro",
  "atl\xE9tico mineiro": "Atletico Mineiro",
  // Copa Libertadores — SX Bet uses full name, Polymarket uses abbreviation or vice versa
  "liga deportiva universitaria de quito": "LDU de Quito",
  "universidad central de venezuela fc": "UCV",
  "universidad central de venezuela": "UCV",
  "cs cristal": "Sporting Cristal",
  // Polymarket "CS Cristal" → SX Bet "Sporting Cristal"
  "cd tolima": "Deportes Tolima",
  // Polymarket "CD Tolima" → SX Bet "Deportes Tolima"
  "tolima": "Deportes Tolima",
  // Copa Libertadores — city suffix or accent differences after stripping
  "penarol de montevideo": "Pe\xF1arol",
  "penarol": "Pe\xF1arol",
  "barcelona sporting club": "Barcelona",
  // Copa Lib Ecuador club
  "barcelona sc": "Barcelona",
  // Polymarket form — override any generated cross-league match
  // Liverpool FC (Uruguay) — prevent false match with English Liverpool
  "liverpool fc uruguay": "Liverpool Uruguay",
  "universidad catolica santiago": "Universidad Cat\xF3lica",
  "universidad catolica": "Universidad Cat\xF3lica",
  "club bolivar": "Bol\xEDvar",
  "bolivar": "Bol\xEDvar",
  // Copa Libertadores — case consistency for "Universitario de Deportes"
  // Generated entry has capital-D form; these MANUAL entries override it
  "club universitario de deportes": "Universitario de Deportes",
  "universitario de deportes": "Universitario de Deportes",
  "club universitario": "Universitario de Deportes",
  // Copa Libertadores — CSyD and AA prefixes not in auto-strip list
  "csyd defensa y justicia": "Defensa y Justicia",
  "csyd macar\xE1": "Macar\xE1",
  "csyd macara": "Macar\xE1",
  "aa argentinos juniors": "Argentinos Juniors",
  // Serie A — Polymarket appends "Calcio" or year suffix to some clubs
  "cagliari calcio": "Cagliari",
  "como 1907": "Como",
  // Serie A — SX Bet uses "Hellas Verona", Polymarket uses "Verona"
  "hellas verona": "Hellas Verona",
  "verona": "Hellas Verona",
  // Serie A — "Calcio" suffix not in auto-strip list
  "udinese calcio": "Udinese",
  "udinese": "Udinese",
  // Serie A — "Calcio" suffix + Polymarket prepends "US"
  "sassuolo calcio": "Sassuolo",
  "us sassuolo calcio": "Sassuolo",
  "sassuolo": "Sassuolo",
  // Serie A — SX Bet uses full legal name, Polymarket uses abbreviation
  "unione sportiva cremonese": "Cremonese",
  "us cremonese": "Cremonese",
  "cremonese": "Cremonese",
  // La Liga — SX Bet uses short form, Polymarket uses full club legal name
  "athletic club": "Athletic Bilbao",
  "athletic bilbao": "Athletic Bilbao",
  "rc celta de vigo": "Celta de Vigo",
  "celta de vigo": "Celta de Vigo",
  "celta": "Celta de Vigo",
  "deportivo alav\xE9s": "Deportivo Alaves",
  "deportivo alaves": "Deportivo Alaves",
  "alav\xE9s": "Deportivo Alaves",
  "alaves": "Deportivo Alaves",
  "rcd espanyol de barcelona": "Espanyol",
  "rcd espanyol": "Espanyol",
  "espanyol": "Espanyol",
  "levante ud": "Levante",
  "levante": "Levante",
  "rcd mallorca": "Mallorca",
  "mallorca": "Mallorca",
  "rayo vallecano de madrid": "Rayo Vallecano",
  "rayo vallecano": "Rayo Vallecano",
  "real betis balompi\xE9": "Real Betis",
  "real betis balompie": "Real Betis",
  "real betis": "Real Betis",
  "real sociedad de f\xFAtbol": "Real Sociedad",
  "real sociedad de futbol": "Real Sociedad",
  "real sociedad": "Real Sociedad",
  // Ligue 1 — SX Bet uses short form, Polymarket uses full club legal name
  "aj auxerre": "Auxerre",
  "auxerre": "Auxerre",
  "angers sco": "Angers",
  "angers sc": "Angers",
  "angers": "Angers",
  "fc lorient": "Lorient",
  "lorient": "Lorient",
  "fc metz": "Metz",
  "metz": "Metz",
  "ogc nice": "Nice",
  "nice": "Nice",
  "rc strasbourg alsace": "Strasbourg",
  "rc strasbourg": "Strasbourg",
  "strasbourg": "Strasbourg",
  "lille osc": "Lille",
  "olympique lyonnais": "Lyon",
  "olympique lyon": "Lyon",
  "lyon": "Lyon",
  "olympique de marseille": "Olympique Marseille",
  "olympique marseille": "Olympique Marseille",
  "marseille": "Olympique Marseille",
  "racing club de lens": "Lens",
  "rc lens": "Lens",
  "lens": "Lens",
  "stade rennais fc 1901": "Rennes",
  "stade rennais": "Rennes",
  "rennes": "Rennes",
  // NBA — Polymarket uses nickname-only (e.g. "Raptors"); SX Bet uses "City Nickname" full form.
  // These mappings make both platforms resolve to the same canonical name for DB matching.
  "hawks": "Atlanta Hawks",
  "celtics": "Boston Celtics",
  "nets": "Brooklyn Nets",
  "hornets": "Charlotte Hornets",
  "bulls": "Chicago Bulls",
  "cavaliers": "Cleveland Cavaliers",
  "mavericks": "Dallas Mavericks",
  "nuggets": "Denver Nuggets",
  "pistons": "Detroit Pistons",
  "warriors": "Golden State Warriors",
  "rockets": "Houston Rockets",
  "pacers": "Indiana Pacers",
  "clippers": "Los Angeles Clippers",
  "lakers": "L.A. Lakers",
  "los angeles lakers": "L.A. Lakers",
  "la lakers": "L.A. Lakers",
  "grizzlies": "Memphis Grizzlies",
  "heat": "Miami Heat",
  "bucks": "Milwaukee Bucks",
  "timberwolves": "Minnesota Timberwolves",
  "pelicans": "New Orleans Pelicans",
  "knicks": "New York Knicks",
  "thunder": "Oklahoma City Thunder",
  "magic": "Orlando Magic",
  "76ers": "Philadelphia 76ers",
  "sixers": "Philadelphia 76ers",
  "suns": "Phoenix Suns",
  "trail blazers": "Portland Trail Blazers",
  "blazers": "Portland Trail Blazers",
  "kings": "Sacramento Kings",
  // 'spurs' and 'san antonio spurs' already mapped above
  "raptors": "Toronto Raptors",
  "jazz": "Utah Jazz",
  "wizards": "Washington Wizards"
};
var MANUAL_BY_SPORT = {
  Hockey: {
    // Polymarket sends nickname-only (e.g. "Sabres"); SX Bet uses "City Nickname".
    "ducks": "Anaheim Ducks",
    "anaheim ducks": "Anaheim Ducks",
    "bruins": "Boston Bruins",
    "boston bruins": "Boston Bruins",
    "sabres": "Buffalo Sabres",
    "buffalo sabres": "Buffalo Sabres",
    "flames": "Calgary Flames",
    "calgary flames": "Calgary Flames",
    "hurricanes": "Carolina Hurricanes",
    "carolina hurricanes": "Carolina Hurricanes",
    "blackhawks": "Chicago Blackhawks",
    "chicago blackhawks": "Chicago Blackhawks",
    "avalanche": "Colorado Avalanche",
    "colorado avalanche": "Colorado Avalanche",
    "blue jackets": "Columbus Blue Jackets",
    "columbus blue jackets": "Columbus Blue Jackets",
    "stars": "Dallas Stars",
    "dallas stars": "Dallas Stars",
    "red wings": "Detroit Red Wings",
    "detroit red wings": "Detroit Red Wings",
    "oilers": "Edmonton Oilers",
    "edmonton oilers": "Edmonton Oilers",
    "panthers": "Florida Panthers",
    "florida panthers": "Florida Panthers",
    "kings": "Los Angeles Kings",
    "los angeles kings": "Los Angeles Kings",
    "la kings": "Los Angeles Kings",
    "wild": "Minnesota Wild",
    "minnesota wild": "Minnesota Wild",
    "canadiens": "Montreal Canadiens",
    "montreal canadiens": "Montreal Canadiens",
    "habs": "Montreal Canadiens",
    "predators": "Nashville Predators",
    "nashville predators": "Nashville Predators",
    "preds": "Nashville Predators",
    "devils": "New Jersey Devils",
    "new jersey devils": "New Jersey Devils",
    "islanders": "New York Islanders",
    "new york islanders": "New York Islanders",
    "rangers": "New York Rangers",
    "new york rangers": "New York Rangers",
    "senators": "Ottawa Senators",
    "ottawa senators": "Ottawa Senators",
    "sens": "Ottawa Senators",
    "flyers": "Philadelphia Flyers",
    "philadelphia flyers": "Philadelphia Flyers",
    "penguins": "Pittsburgh Penguins",
    "pittsburgh penguins": "Pittsburgh Penguins",
    "pens": "Pittsburgh Penguins",
    "sharks": "San Jose Sharks",
    "san jose sharks": "San Jose Sharks",
    "kraken": "Seattle Kraken",
    "seattle kraken": "Seattle Kraken",
    "blues": "St. Louis Blues",
    "st. louis blues": "St. Louis Blues",
    "st louis blues": "St. Louis Blues",
    "lightning": "Tampa Bay Lightning",
    "tampa bay lightning": "Tampa Bay Lightning",
    "bolts": "Tampa Bay Lightning",
    "maple leafs": "Toronto Maple Leafs",
    "toronto maple leafs": "Toronto Maple Leafs",
    "leafs": "Toronto Maple Leafs",
    // Utah is mid-rebrand: Polymarket has both "Utah" and "Mammoth"; SX is still "Utah Hockey Club"
    "utah": "Utah Hockey Club",
    "mammoth": "Utah Hockey Club",
    "utah mammoth": "Utah Hockey Club",
    "utah hockey club": "Utah Hockey Club",
    "canucks": "Vancouver Canucks",
    "vancouver canucks": "Vancouver Canucks",
    "golden knights": "Vegas Golden Knights",
    "vegas golden knights": "Vegas Golden Knights",
    "vgk": "Vegas Golden Knights",
    "capitals": "Washington Capitals",
    "washington capitals": "Washington Capitals",
    "caps": "Washington Capitals",
    "jets": "Winnipeg Jets",
    "winnipeg jets": "Winnipeg Jets"
  }
};
var CANONICAL = { ...GENERATED_CANONICAL, ...MANUAL };
var STRIP_PREFIX = /^(ca|cd|cf|csd|se|sc|sd|ec|cr|cs|gd|fk|nk|bk|as|ac|sl|sk|rb|afc|ssc|bsc|hsv|club)\s+/i;
var STRIP_SUFFIX = /\s+(fc|cf|sc|sd|afc|ssc|kv|ac|bk|if)$/i;
var STRIP_PARENS = /\s*\([^)]*\)\s*$/;
function stripAffixes(raw) {
  return raw.trim().replace(STRIP_PARENS, "").replace(STRIP_PREFIX, "").replace(STRIP_SUFFIX, "").trim();
}
function canonicalTeamName(raw, sport) {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const sportMap = sport ? MANUAL_BY_SPORT[sport] : void 0;
  if (sportMap && sportMap[lower]) return sportMap[lower];
  if (CANONICAL[lower]) return CANONICAL[lower];
  const stripped = stripAffixes(trimmed);
  const strippedLower = stripped.toLowerCase();
  if (strippedLower !== lower) {
    if (sportMap && sportMap[strippedLower]) return sportMap[strippedLower];
    if (CANONICAL[strippedLower]) return CANONICAL[strippedLower];
  }
  if (stripped && stripped !== trimmed) return stripped;
  return trimmed;
}

// ../bot/src/leagues.ts
var EPL = {
  name: "EPL",
  sport: "Soccer",
  hasDraw: true,
  sxbet: { leagueId: 29 },
  polymarket: { seriesId: 10188, titleOrdering: "home" }
};
var UCL = {
  name: "UCL",
  sport: "Soccer",
  hasDraw: true,
  sxbet: { leagueId: 30 },
  polymarket: { seriesId: 10204, titleOrdering: "home" }
};
var UEL = {
  name: "UEL",
  sport: "Soccer",
  hasDraw: true,
  sxbet: { leagueId: 31 },
  polymarket: { seriesId: 10209, titleOrdering: "home" }
};
var COPA_LIBERTADORES = {
  name: "Copa Libertadores",
  sport: "Soccer",
  hasDraw: true,
  sxbet: { leagueId: 1631 },
  polymarket: { seriesId: 10289, titleOrdering: "home" }
};
var LA_LIGA = {
  name: "La Liga",
  sport: "Soccer",
  hasDraw: true,
  sxbet: { leagueId: 1114 },
  polymarket: { seriesId: 10193, titleOrdering: "home" }
};
var SERIE_A = {
  name: "Serie A",
  sport: "Soccer",
  hasDraw: true,
  sxbet: { leagueId: 1113 },
  polymarket: { seriesId: 10203, titleOrdering: "home" }
};
var BUNDESLIGA = {
  name: "Bundesliga",
  sport: "Soccer",
  hasDraw: true,
  sxbet: { leagueId: 244 },
  polymarket: { seriesId: 10194, titleOrdering: "home" }
};
var EREDIVISIE = {
  name: "Eredivisie",
  sport: "Soccer",
  hasDraw: true,
  sxbet: { leagueId: 1330 },
  polymarket: { seriesId: 10286, titleOrdering: "home" }
};
var LIGUE_1 = {
  name: "Ligue 1",
  sport: "Soccer",
  hasDraw: true,
  sxbet: { leagueId: 1112 },
  polymarket: { seriesId: 10195, titleOrdering: "home" }
};
var NBA = {
  name: "NBA",
  sport: "Basketball",
  hasDraw: false,
  sxbet: { leagueId: 1, sportId: 1 },
  // seriesId 10345 = NBA daily games series — scopes to individual game markets only,
  // excluding playoff series/special-event markets that share the 'nba' tag slug.
  // Polymarket NBA titles list AWAY first ("Visitor at Home").
  polymarket: { seriesId: 10345, titleOrdering: "away" }
};
var MLB = {
  name: "MLB",
  sport: "Baseball",
  hasDraw: false,
  sxbet: { leagueId: 171, sportId: 3 },
  // seriesId 3 = MLB daily games series. Polymarket MLB titles list AWAY first.
  polymarket: { seriesId: 3, titleOrdering: "away" }
};
var NHL = {
  name: "NHL",
  sport: "Hockey",
  hasDraw: false,
  sxbet: { leagueId: 3, sportId: 2 },
  // seriesId 10346 = NHL daily games series. Polymarket NHL titles list AWAY first.
  polymarket: { seriesId: 10346, titleOrdering: "away" }
};
var ACTIVE_LEAGUE = UCL;

// ../bot/src/logger.ts
var import_pino = __toESM(require("pino"));
var import_pino_pretty = __toESM(require("pino-pretty"));
var isDev = config.NODE_ENV !== "production";
var stream = isDev ? (0, import_pino_pretty.default)({
  colorize: true,
  translateTime: "HH:MM:ss.l",
  ignore: "pid,hostname",
  messageFormat: "[{module}] {msg}"
}) : process.stdout;
var root = (0, import_pino.default)(
  {
    level: config.LOG_LEVEL,
    base: void 0,
    redact: {
      paths: [
        "*.privateKey",
        "*.apiKey",
        "*.secret",
        "*.passphrase",
        "*.token",
        "privateKey",
        "apiKey",
        "secret",
        "passphrase",
        "token"
      ],
      censor: "[REDACTED]"
    }
  },
  stream
);
var createLogger = (module2) => root.child({ module: module2 });

// ../bot/src/adapters/sxbet.ts
var log = createLogger("sxbet");
var BASE_TOKEN = "0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B";
var ODDS_PRECISION = BigInt("100000000000000000000");
var USDC_DECIMALS = 1e6;
var TOP_LEVELS = 5;
var ORDER_BATCH_SIZE = 30;
var BATCH_DELAY_MS = 600;
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchWithRetry(url) {
  const res = await fetch(url);
  if (res.status === 429) {
    log.warn("rate limited, retrying in 10s");
    await sleep(1e4);
    return fetch(url);
  }
  return res;
}
async function fetchAllActiveMarkets(leagueId) {
  const markets = [];
  let paginationKey;
  do {
    const params = new URLSearchParams({
      pageSize: "50",
      leagueId: String(leagueId)
    });
    if (paginationKey) params.set("paginationKey", paginationKey);
    const res = await fetchWithRetry(`${config.SX_BET_API_URL}/markets/active?${params}`);
    if (!res.ok) throw new Error(`GET /markets/active returned ${res.status}`);
    const body = await res.json();
    markets.push(...body.data.markets);
    paginationKey = body.data.nextKey || void 0;
  } while (paginationKey);
  return markets;
}
async function fetchOrdersForHashes(hashes) {
  const params = new URLSearchParams({
    marketHashes: hashes.join(","),
    baseToken: BASE_TOKEN
  });
  const url = `${config.SX_BET_API_URL}/orders?${params}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`GET /orders returned ${res.status}`);
  const body = await res.json();
  return body.data;
}
function buildOutcome(label, orders, takerBettingOutcomeOne) {
  const relevantOrders = orders.filter(
    (o) => o.isMakerBettingOutcomeOne !== takerBettingOutcomeOne
  );
  const levelMap = /* @__PURE__ */ new Map();
  let totalAvailableUsdc = 0;
  for (const o of relevantOrders) {
    const makerRemaining = BigInt(o.totalBetSize) - BigInt(o.fillAmount);
    if (makerRemaining <= 0n) continue;
    const takerSpace = makerRemaining * ODDS_PRECISION / BigInt(o.percentageOdds) - makerRemaining;
    const takerUsdc = Number(takerSpace) / USDC_DECIMALS;
    const makerImplied = parseFloat(o.percentageOdds) / 1e20;
    const takerOdds = parseFloat((1 - makerImplied).toFixed(8));
    levelMap.set(takerOdds, (levelMap.get(takerOdds) ?? 0) + takerUsdc);
    totalAvailableUsdc += takerUsdc;
  }
  const topLevels = Array.from(levelMap.entries()).map(([odds, size]) => ({ odds, size })).sort((a, b) => a.odds - b.odds).slice(0, TOP_LEVELS);
  const bestOdds = topLevels[0]?.odds ?? 0;
  return {
    label,
    impliedOdds: bestOdds,
    liquidityDepth: { availableSize: totalAvailableUsdc, topLevels }
  };
}
var GAME_LINE_TYPES = /* @__PURE__ */ new Set([52, 226, 3, 342, 2, 28]);
function betTypeFromSxType(type) {
  if (type === 52 || type === 226) return "12";
  if (type === 3 || type === 342) return "spread";
  return "total";
}
function canonicalizeOutcomeLabel(rawLabel, rawHome, rawAway, homeCanonical, awayCanonical) {
  if (rawLabel.startsWith(rawHome)) return homeCanonical + rawLabel.slice(rawHome.length);
  if (rawLabel.startsWith(rawAway)) return awayCanonical + rawLabel.slice(rawAway.length);
  return rawLabel;
}
async function fetchSxBetMarkets(league = ACTIVE_LEAGUE) {
  const allMarkets = await fetchAllActiveMarkets(league.sxbet.leagueId);
  if (allMarkets.length === 0) {
    log.warn({ league: league.name, leagueId: league.sxbet.leagueId }, "API returned 0 markets");
    return [];
  }
  const type1Markets = league.hasDraw ? allMarkets.filter((m) => m.type === 1) : [];
  const gameLinesMarkets = allMarkets.filter(
    (m) => GAME_LINE_TYPES.has(m.type) && m.teamOneName && m.teamTwoName
  );
  const gameMap = /* @__PURE__ */ new Map();
  for (const market of type1Markets) {
    const rawHome = (market.teamOneName ?? "").trim();
    const rawAway = (market.teamTwoName ?? "").trim();
    if (!rawHome || !rawAway) continue;
    const key = `${market.gameTime}|${rawHome}|${rawAway}`;
    if (!gameMap.has(key)) {
      gameMap.set(key, {
        homeTeam: canonicalTeamName(rawHome, league.sport),
        awayTeam: canonicalTeamName(rawAway, league.sport),
        gameTime: market.gameTime,
        sportLabel: market.sportLabel,
        sxEventId: market.sportXeventId
      });
    }
    const entry = gameMap.get(key);
    const o1Lower = market.outcomeOneName.toLowerCase().trim();
    if (o1Lower === rawHome.toLowerCase()) {
      entry.homeWinMarket = market;
    } else if (o1Lower === "tie") {
      entry.drawMarket = market;
    } else if (o1Lower === rawAway.toLowerCase()) {
      entry.awayWinMarket = market;
    }
  }
  const allHashes = [];
  for (const entry of gameMap.values()) {
    if (entry.homeWinMarket) allHashes.push(entry.homeWinMarket.marketHash);
    if (entry.drawMarket) allHashes.push(entry.drawMarket.marketHash);
    if (entry.awayWinMarket) allHashes.push(entry.awayWinMarket.marketHash);
  }
  for (const m of gameLinesMarkets) allHashes.push(m.marketHash);
  const ordersMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < allHashes.length; i += ORDER_BATCH_SIZE) {
    const batch = allHashes.slice(i, i + ORDER_BATCH_SIZE);
    const batchNum = Math.floor(i / ORDER_BATCH_SIZE) + 1;
    try {
      const orders = await fetchOrdersForHashes(batch);
      for (const order of orders) {
        const list = ordersMap.get(order.marketHash) ?? [];
        list.push(order);
        ordersMap.set(order.marketHash, list);
      }
    } catch (err) {
      log.error({ err, batchNum }, "failed to fetch orders batch");
    }
    if (i + ORDER_BATCH_SIZE < allHashes.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  const quotes = [];
  for (const [, entry] of gameMap) {
    if (!entry.homeWinMarket) continue;
    const name = `${entry.homeTeam} vs ${entry.awayTeam}`;
    const outcomes = [];
    const homeOrders = ordersMap.get(entry.homeWinMarket.marketHash) ?? [];
    const homeOut = buildOutcome(entry.homeTeam, homeOrders, true);
    homeOut.externalId = `${entry.homeWinMarket.marketHash}:0`;
    outcomes.push(homeOut);
    const notHomeOut = buildOutcome(`Not ${entry.homeTeam}`, homeOrders, false);
    notHomeOut.externalId = `${entry.homeWinMarket.marketHash}:1`;
    outcomes.push(notHomeOut);
    if (entry.drawMarket) {
      const drawOrders = ordersMap.get(entry.drawMarket.marketHash) ?? [];
      const drawOut = buildOutcome("Draw", drawOrders, true);
      drawOut.externalId = `${entry.drawMarket.marketHash}:0`;
      outcomes.push(drawOut);
      const notDrawOut = buildOutcome("Not Draw", drawOrders, false);
      notDrawOut.externalId = `${entry.drawMarket.marketHash}:1`;
      outcomes.push(notDrawOut);
    }
    if (entry.awayWinMarket) {
      const awayOrders = ordersMap.get(entry.awayWinMarket.marketHash) ?? [];
      const awayOut = buildOutcome(entry.awayTeam, awayOrders, true);
      awayOut.externalId = `${entry.awayWinMarket.marketHash}:0`;
      outcomes.push(awayOut);
      const notAwayOut = buildOutcome(`Not ${entry.awayTeam}`, awayOrders, false);
      notAwayOut.externalId = `${entry.awayWinMarket.marketHash}:1`;
      outcomes.push(notAwayOut);
    }
    quotes.push({
      platform: "sx",
      externalId: entry.homeWinMarket.marketHash,
      // home-win hash is the game's stable ID
      sport: entry.sportLabel,
      league: league.name,
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      name,
      startTime: new Date(entry.homeWinMarket.gameTime * 1e3),
      betType: "1x2",
      mainLine: true,
      sxEventId: entry.sxEventId,
      outcomes
    });
  }
  for (const market of gameLinesMarkets) {
    const rawHome = (market.teamOneName ?? "").trim();
    const rawAway = (market.teamTwoName ?? "").trim();
    if (!rawHome || !rawAway) continue;
    const homeTeam = canonicalTeamName(rawHome, league.sport);
    const awayTeam = canonicalTeamName(rawAway, league.sport);
    const orders = ordersMap.get(market.marketHash) ?? [];
    const labelOne = canonicalizeOutcomeLabel(market.outcomeOneName, rawHome, rawAway, homeTeam, awayTeam);
    const labelTwo = canonicalizeOutcomeLabel(market.outcomeTwoName, rawHome, rawAway, homeTeam, awayTeam);
    const outcomeOne = buildOutcome(labelOne, orders, true);
    outcomeOne.externalId = `${market.marketHash}:0`;
    const outcomeTwo = buildOutcome(labelTwo, orders, false);
    outcomeTwo.externalId = `${market.marketHash}:1`;
    quotes.push({
      platform: "sx",
      externalId: market.marketHash,
      sport: market.sportLabel,
      league: league.name,
      homeTeam,
      awayTeam,
      name: `${homeTeam} vs ${awayTeam}`,
      startTime: new Date(market.gameTime * 1e3),
      betType: betTypeFromSxType(market.type),
      line: market.line,
      mainLine: market.mainLine ?? true,
      sxEventId: market.sportXeventId,
      outcomes: [outcomeOne, outcomeTwo]
    });
  }
  const glCount = quotes.filter((q) => q.betType !== "1x2").length;
  log.info(
    { league: league.name, total: quotes.length, oneXTwo: quotes.length - glCount, gameLines: glCount, sourceMarkets: allMarkets.length },
    "fetched quotes"
  );
  return quotes;
}

// ../bot/src/services/polymarketBookCache.ts
var import_events = require("events");
var DEFAULT_TOP_LEVELS = 10;
var MIN_TOP_LEVELS = 3;
var MAX_TOP_LEVELS = 25;
function applyFee(p, feeRate) {
  if (feeRate === 0) return p;
  return p + feeRate * p * (1 - p);
}
var PolymarketBookCache = class extends import_events.EventEmitter {
  books = /* @__PURE__ */ new Map();
  // Per-token taker fee rate sourced from V2 `getClobMarketInfo` (fd.r). Unknown tokens default to 0
  // (un-adjusted), not the legacy 0.03 — better to under-show fees than to guess wrong post-V2.
  feeRates = /* @__PURE__ */ new Map();
  topLevels = DEFAULT_TOP_LEVELS;
  // topLevels is pushed in via setTopLevels() — at startup from botConfig and
  // live from the config route — rather than read from the DB here. That keeps
  // this cache free of any DB import, so the read-only public build can reuse
  // the Polymarket adapter (which depends on this cache) in a serverless
  // function without dragging Prisma into the bundle.
  setTopLevels(n) {
    this.topLevels = Math.max(MIN_TOP_LEVELS, Math.min(MAX_TOP_LEVELS, n));
  }
  getTopLevels() {
    return this.topLevels;
  }
  setFeeRate(tokenId, feeRate) {
    const prev = this.feeRates.get(tokenId);
    this.feeRates.set(tokenId, feeRate);
    if (prev === feeRate) return;
    if (this.books.has(tokenId)) this.emitUpdate(tokenId);
  }
  getFeeRate(tokenId) {
    return this.feeRates.get(tokenId) ?? 0;
  }
  getOrCreate(tokenId) {
    let entry = this.books.get(tokenId);
    if (!entry) {
      entry = { asks: /* @__PURE__ */ new Map(), bids: /* @__PURE__ */ new Map(), updatedAt: 0 };
      this.books.set(tokenId, entry);
    }
    return entry;
  }
  replaceBook(tokenId, bids, asks, updatedAt) {
    const entry = this.getOrCreate(tokenId);
    if (updatedAt < entry.updatedAt) return;
    entry.asks = /* @__PURE__ */ new Map();
    entry.bids = /* @__PURE__ */ new Map();
    for (const a of asks) {
      const size = parseFloat(a.size);
      if (size > 0) entry.asks.set(a.price, size);
    }
    for (const b of bids) {
      const size = parseFloat(b.size);
      if (size > 0) entry.bids.set(b.price, size);
    }
    entry.updatedAt = updatedAt;
    this.emitUpdate(tokenId);
  }
  applyPriceChange(tokenId, changes, updatedAt) {
    if (changes.length === 0) return;
    const entry = this.getOrCreate(tokenId);
    if (updatedAt < entry.updatedAt) return;
    let changed = false;
    for (const c of changes) {
      const target = c.side === "SELL" ? entry.asks : entry.bids;
      if (c.size === "0" || parseFloat(c.size) <= 0) {
        if (target.delete(c.price)) changed = true;
      } else {
        target.set(c.price, parseFloat(c.size));
        changed = true;
      }
    }
    if (!changed) return;
    entry.updatedAt = updatedAt;
    this.emitUpdate(tokenId);
  }
  clearBook(tokenId) {
    this.books.delete(tokenId);
  }
  getLevels(tokenId) {
    const entry = this.books.get(tokenId);
    if (!entry) return [];
    const feeRate = this.getFeeRate(tokenId);
    return Array.from(entry.asks.entries()).map(([price, shares]) => {
      const rawPrice = parseFloat(price);
      return {
        odds: applyFee(rawPrice, feeRate),
        size: shares * rawPrice
      };
    }).sort((a, b) => a.odds - b.odds).slice(0, this.topLevels);
  }
  hasToken(tokenId) {
    return this.books.has(tokenId);
  }
  // Raw (un-fee-adjusted) top-of-book prices, sourced directly from the ask/bid
  // maps. Returned numbers are in raw CLOB price space (0–1), matching what the
  // `best_bid_ask` WS frame carries — callers that want fee-adjusted taker odds
  // should run them through `applyFee` themselves.
  getTopOfBook(tokenId) {
    const entry = this.books.get(tokenId);
    if (!entry) return null;
    let bestAsk;
    for (const price of entry.asks.keys()) {
      const p = parseFloat(price);
      if (!Number.isFinite(p) || p <= 0) continue;
      if (bestAsk === void 0 || p < bestAsk) bestAsk = p;
    }
    let bestBid;
    for (const price of entry.bids.keys()) {
      const p = parseFloat(price);
      if (!Number.isFinite(p) || p <= 0) continue;
      if (bestBid === void 0 || p > bestBid) bestBid = p;
    }
    return { bestAsk, bestBid, updatedAt: entry.updatedAt };
  }
  emitUpdate(tokenId) {
    const levels = this.getLevels(tokenId);
    this.emit("polyBookUpdate", { tokenId, levels });
  }
};
var polymarketBookCache = new PolymarketBookCache();

// ../bot/src/services/polymarketOddsCache.ts
var import_events2 = require("events");
function applyFee2(p, feeRate) {
  if (feeRate === 0) return p;
  return p + feeRate * p * (1 - p);
}
var PolymarketOddsCache = class extends import_events2.EventEmitter {
  entries = /* @__PURE__ */ new Map();
  // Per-token taker fee rate from V2 `getClobMarketInfo` (fd.r). Unknown tokens default to 0.
  feeRates = /* @__PURE__ */ new Map();
  setFeeRate(tokenId, feeRate) {
    const prev = this.feeRates.get(tokenId);
    this.feeRates.set(tokenId, feeRate);
    if (prev === feeRate) return;
    const entry = this.entries.get(tokenId);
    if (!entry) return;
    const takerOdds = applyFee2(entry.bestAsk, feeRate);
    this.emit("polyOddsUpdate", { tokenId, takerOdds, updatedAt: entry.updatedAt });
  }
  getFeeRate(tokenId) {
    return this.feeRates.get(tokenId) ?? 0;
  }
  set(tokenId, bestAsk, bestBid, updatedAt) {
    const existing = this.entries.get(tokenId);
    if (existing && existing.updatedAt >= updatedAt) return;
    const entry = { tokenId, bestAsk, bestBid, updatedAt };
    this.entries.set(tokenId, entry);
    const takerOdds = applyFee2(bestAsk, this.getFeeRate(tokenId));
    const payload = { tokenId, takerOdds, updatedAt };
    this.emit("polyOddsUpdate", payload);
  }
  get(tokenId) {
    return this.entries.get(tokenId);
  }
  getTakerOdds(tokenId) {
    const e = this.entries.get(tokenId);
    if (!e) return void 0;
    return applyFee2(e.bestAsk, this.getFeeRate(tokenId));
  }
  getSnapshot() {
    const out = [];
    for (const e of this.entries.values()) {
      out.push({
        tokenId: e.tokenId,
        takerOdds: applyFee2(e.bestAsk, this.getFeeRate(e.tokenId)),
        updatedAt: e.updatedAt
      });
    }
    return out;
  }
  has(tokenId) {
    return this.entries.has(tokenId);
  }
  clear(tokenId) {
    this.entries.delete(tokenId);
  }
  // Audit helper: list cached tokens that have NEVER had setFeeRate called
  // (the source of "this token's odds aren't fee-adjusted" bugs at startup).
  unregisteredTokens() {
    const out = [];
    for (const tokenId of this.entries.keys()) {
      if (!this.feeRates.has(tokenId)) out.push(tokenId);
    }
    return out;
  }
  // Audit helper: list cached tokens whose registered fee rate is 0 (un-adjusted).
  // Includes both "never registered" (set-but-no-rate) and "registered as 0".
  zeroRateTokens() {
    const out = [];
    for (const tokenId of this.entries.keys()) {
      if (this.getFeeRate(tokenId) === 0) out.push(tokenId);
    }
    return out;
  }
  // Audit helper: count of registered tokens by exact rate value.
  // Confirms every sports market is on the same 0.03 rate (or surfaces outliers).
  rateDistribution() {
    const out = {};
    for (const rate of this.feeRates.values()) {
      const key = rate.toString();
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }
};
var polymarketOddsCache = new PolymarketOddsCache();

// ../bot/src/adapters/polymarket.ts
var log2 = createLogger("polymarket");
var GAMMA_API = "https://gamma-api.polymarket.com";
var CLOB_API = "https://clob.polymarket.com";
var GAMMA_LIMIT = 500;
var CLOB_BATCH_SIZE = 10;
var CLOB_BATCH_DELAY_MS = 200;
var TOP_LEVELS2 = 5;
var SPORTS_FEE_RATE = 0.03;
var SMOKE_CHECK_TIMEOUT_MS = 6e3;
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function applyFee3(p, feeRate) {
  if (feeRate === 0) return p;
  return p + feeRate * p * (1 - p);
}
function parseJsonField(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
async function fetchLeagueEvents(league) {
  const pm = league.polymarket;
  const events = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      active: "true",
      closed: "false",
      limit: String(GAMMA_LIMIT),
      offset: String(offset),
      series_id: String(pm.seriesId)
    });
    const res = await fetch(`${GAMMA_API}/events?${params}`);
    if (!res.ok) throw new Error(`Gamma GET /events returned ${res.status}`);
    const pageData = await res.json();
    if (!pageData.length) break;
    events.push(...pageData);
    if (pageData.length < GAMMA_LIMIT) break;
    offset += GAMMA_LIMIT;
  }
  return events;
}
async function fetchClobBook(tokenId) {
  try {
    const res = await fetch(`${CLOB_API}/book?token_id=${encodeURIComponent(tokenId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function smokeCheckSportsFeeRate(conditionId) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SMOKE_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${CLOB_API}/clob-markets/${encodeURIComponent(conditionId)}`,
      { signal: ctrl.signal }
    );
    if (!res.ok) return;
    const info = await res.json();
    const observed = info.fd?.r;
    if (typeof observed !== "number") return;
    if (Math.abs(observed - SPORTS_FEE_RATE) > 1e-9) {
      log2.warn(
        { conditionId, observed, hardcoded: SPORTS_FEE_RATE },
        "fee rate mismatch \u2014 update SPORTS_FEE_RATE"
      );
    }
  } catch {
  } finally {
    clearTimeout(timer);
  }
}
async function fetchClobBooksForTokens(tokenIds) {
  const result = /* @__PURE__ */ new Map();
  for (let i = 0; i < tokenIds.length; i += CLOB_BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + CLOB_BATCH_SIZE);
    const books = await Promise.allSettled(batch.map((id) => fetchClobBook(id)));
    for (let j = 0; j < batch.length; j++) {
      const settled = books[j];
      if (settled.status === "fulfilled" && settled.value) {
        result.set(batch[j], settled.value);
      }
    }
    if (i + CLOB_BATCH_SIZE < tokenIds.length) {
      await sleep2(CLOB_BATCH_DELAY_MS);
    }
  }
  return result;
}
function buildOutcomeFromBook(label, book, fallbackPrice, fallbackLiquidity, feeRate = 0) {
  if (!book || !book.asks.length) {
    return {
      label,
      impliedOdds: applyFee3(fallbackPrice, feeRate),
      liquidityDepth: { availableSize: fallbackLiquidity, topLevels: [] }
    };
  }
  const sortedAsks = [...book.asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  const topLevels = sortedAsks.slice(0, TOP_LEVELS2).map((a) => ({ odds: applyFee3(parseFloat(a.price), feeRate), size: parseFloat(a.size) * parseFloat(a.price) }));
  const availableSize = sortedAsks.reduce((sum, a) => sum + parseFloat(a.size) * parseFloat(a.price), 0);
  const bestOdds = topLevels[0]?.odds ?? applyFee3(fallbackPrice, feeRate);
  return {
    label,
    impliedOdds: bestOdds,
    liquidityDepth: { availableSize, topLevels }
  };
}
function startTimeFromEvent(event) {
  const raw = event.markets.find((m) => m.gameStartTime)?.gameStartTime;
  if (raw) {
    const iso = raw.replace(" ", "T").replace(/\+00$/, "+00:00");
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(event.endDate ?? event.startDate);
}
function extractTeams(title, titleOrdering) {
  const stripped = title.replace(/^[^:]+:\s*/, "").replace(/\s+-\s+.+$/, "");
  const match = stripped.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!match) return null;
  const first = match[1].trim();
  const second = match[2].trim();
  return titleOrdering === "home" ? [first, second] : [second, first];
}
function isMoneylineMarket(m) {
  return !m.sportsMarketType || m.sportsMarketType === "moneyline";
}
function findHomeWinMarket(markets, homeTeam, awayTeam) {
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();
  return markets.find((m) => {
    if (!m.active || m.closed) return false;
    if (!isMoneylineMarket(m)) return false;
    const q = m.question.toLowerCase();
    if (q.includes("draw")) return false;
    const homeIdx = q.indexOf(homeLower);
    if (homeIdx < 0) return false;
    const awayIdx = q.indexOf(awayLower);
    if (awayIdx >= 0) return homeIdx < awayIdx;
    return true;
  });
}
function findAwayWinMarket(markets, homeTeam, awayTeam) {
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();
  return markets.find((m) => {
    if (!m.active || m.closed) return false;
    if (!isMoneylineMarket(m)) return false;
    const q = m.question.toLowerCase();
    if (q.includes("draw")) return false;
    const awayIdx = q.indexOf(awayLower);
    if (awayIdx < 0) return false;
    const homeIdx = q.indexOf(homeLower);
    if (homeIdx >= 0) return awayIdx < homeIdx;
    return true;
  });
}
function findDrawMarket(markets) {
  return markets.find((m) => {
    if (!m.active || m.closed) return false;
    if (!isMoneylineMarket(m)) return false;
    const q = m.question.toLowerCase();
    return q.includes("draw") || q.includes("tie");
  });
}
function eventTitleSuffix(title) {
  const dashIdx = title.indexOf(" - ");
  return dashIdx >= 0 ? title.slice(dashIdx + 3).toLowerCase() : "";
}
var GAME_LINES_SUFFIX_KEYWORDS = [
  "more markets",
  "goal",
  "total",
  "over",
  "under",
  "handicap",
  "spread"
];
function isGameLinesEvent(title) {
  const suffix = eventTitleSuffix(title);
  return GAME_LINES_SUFFIX_KEYWORDS.some((kw) => suffix.includes(kw));
}
function parseGameLineSubMarket(market, sport, feeRate) {
  if (!market.active || market.closed) return null;
  let betType = null;
  if (market.sportsMarketType === "spreads") betType = "spread";
  else if (market.sportsMarketType === "totals") betType = "total";
  else {
    const q = market.question.toLowerCase();
    if (q.startsWith("spread:")) betType = "spread";
    else if (q.startsWith("total:") || q.includes("over") || q.includes("under")) betType = "total";
  }
  if (!betType) return null;
  if (market.line === void 0 || market.line === null) return null;
  const lineVal = market.line;
  const tokens = parseJsonField(market.clobTokenIds);
  if (!tokens[0] || !tokens[1]) return null;
  const prices = parseJsonField(market.outcomePrices).map(Number);
  const outcomeLabels = parseJsonField(market.outcomes);
  const liq = parseFloat(market.liquidity ?? "0") / 2;
  const genericLabels = !outcomeLabels[0] || outcomeLabels[0] === "Yes" || outcomeLabels[0] === "No";
  let labelOne;
  let labelTwo;
  const absLine = Math.abs(lineVal);
  if (betType === "spread") {
    if (!genericLabels && outcomeLabels.length >= 2) {
      const team1 = canonicalTeamName(outcomeLabels[0], sport);
      const team2 = canonicalTeamName(outcomeLabels[1], sport);
      labelOne = lineVal <= 0 ? `${team1} -${absLine}` : `${team1} +${absLine}`;
      labelTwo = lineVal <= 0 ? `${team2} +${absLine}` : `${team2} -${absLine}`;
    } else {
      const q = market.question;
      const teamMatch = q.match(/Spread:\s*(.+?)\s*\(/i);
      if (!teamMatch) return null;
      const team1 = canonicalTeamName(teamMatch[1].trim(), sport);
      labelOne = lineVal <= 0 ? `${team1} -${absLine}` : `${team1} +${absLine}`;
      labelTwo = lineVal <= 0 ? `Other +${absLine}` : `Other -${absLine}`;
    }
  } else {
    if (!genericLabels && outcomeLabels.length >= 2) {
      const o1Lower = outcomeLabels[0].toLowerCase();
      if (o1Lower.includes("over") || o1Lower.includes("under")) {
        const hasNumber = /\d/.test(outcomeLabels[0]);
        labelOne = hasNumber ? outcomeLabels[0] : `${outcomeLabels[0]} ${absLine}`;
        labelTwo = hasNumber ? outcomeLabels[1] : `${outcomeLabels[1]} ${absLine}`;
      } else {
        labelOne = `Over ${absLine}`;
        labelTwo = `Under ${absLine}`;
      }
    } else {
      const qLower = market.question.toLowerCase();
      if (qLower.includes("under") && !qLower.includes("over")) {
        labelOne = `Under ${absLine}`;
        labelTwo = `Over ${absLine}`;
      } else {
        labelOne = `Over ${absLine}`;
        labelTwo = `Under ${absLine}`;
      }
    }
  }
  return {
    betType,
    line: lineVal,
    labelOne,
    labelTwo,
    tokenOne: tokens[0],
    tokenTwo: tokens[1],
    fallbackOne: prices[0] ?? 0,
    fallbackTwo: prices[1] ?? 0,
    liquidityEach: liq,
    feeRate
  };
}
async function fetchPolymarketMarkets(league = ACTIVE_LEAGUE) {
  if (!league.polymarket) return [];
  const allEvents = await fetchLeagueEvents(league);
  if (!allEvents.length) return [];
  const matchEvents = allEvents.filter((e) => !e.title.includes(" - "));
  const gameLinesRaw = allEvents.filter((e) => e.title.includes(" - "));
  const matchEntries = [];
  const glItems = [];
  const allTokenIds = [];
  const feeRateOf = (_m) => SPORTS_FEE_RATE;
  for (const event of matchEvents) {
    const teams = extractTeams(event.title, league.polymarket.titleOrdering);
    if (!teams) continue;
    const [rawHome, rawAway] = teams;
    const homeTeam = canonicalTeamName(rawHome, league.sport);
    const awayTeam = canonicalTeamName(rawAway, league.sport);
    const outcomeEntries = [];
    if (!league.hasDraw) {
      const mlMarket = event.markets.find((m) => m.active && !m.closed && isMoneylineMarket(m));
      if (!mlMarket) continue;
      const tokens = parseJsonField(mlMarket.clobTokenIds);
      const prices = parseJsonField(mlMarket.outcomePrices).map(Number);
      const outcomeLabels = parseJsonField(mlMarket.outcomes);
      const liq = parseFloat(mlMarket.liquidity) / 2;
      const feeRate = feeRateOf(mlMarket);
      for (let i = 0; i < 2; i++) {
        if (!tokens[i]) continue;
        const rawTeam = outcomeLabels[i] ?? "";
        const teamName = canonicalTeamName(rawTeam, league.sport);
        outcomeEntries.push({
          label: teamName,
          tokenId: tokens[i],
          fallbackPrice: prices[i] ?? 0,
          liquidity: liq,
          feeRate
        });
        allTokenIds.push(tokens[i]);
      }
    } else {
      const homeWinMarket = findHomeWinMarket(event.markets, rawHome, rawAway);
      if (!homeWinMarket) continue;
      const tokens = parseJsonField(homeWinMarket.clobTokenIds);
      const prices = parseJsonField(homeWinMarket.outcomePrices).map(Number);
      const liq = parseFloat(homeWinMarket.liquidity) / 2;
      const feeRate = feeRateOf(homeWinMarket);
      if (tokens[0]) {
        outcomeEntries.push({
          label: homeTeam,
          tokenId: tokens[0],
          fallbackPrice: prices[0] ?? 0,
          liquidity: liq,
          feeRate
        });
        allTokenIds.push(tokens[0]);
      }
      if (tokens[1]) {
        outcomeEntries.push({
          label: `Not ${homeTeam}`,
          tokenId: tokens[1],
          fallbackPrice: prices[1] ?? 0,
          liquidity: liq,
          feeRate
        });
        allTokenIds.push(tokens[1]);
      }
    }
    if (league.hasDraw) {
      const drawMarket = findDrawMarket(event.markets);
      if (drawMarket) {
        const tokens = parseJsonField(drawMarket.clobTokenIds);
        const prices = parseJsonField(drawMarket.outcomePrices).map(Number);
        const liq = parseFloat(drawMarket.liquidity) / 2;
        const feeRate = feeRateOf(drawMarket);
        if (tokens[0]) {
          outcomeEntries.push({ label: "Draw", tokenId: tokens[0], fallbackPrice: prices[0] ?? 0, liquidity: liq, feeRate });
          allTokenIds.push(tokens[0]);
        }
        if (tokens[1]) {
          outcomeEntries.push({ label: "Not Draw", tokenId: tokens[1], fallbackPrice: prices[1] ?? 0, liquidity: liq, feeRate });
          allTokenIds.push(tokens[1]);
        }
      }
      const awayWinMarket = findAwayWinMarket(event.markets, rawHome, rawAway);
      if (awayWinMarket) {
        const tokens = parseJsonField(awayWinMarket.clobTokenIds);
        const prices = parseJsonField(awayWinMarket.outcomePrices).map(Number);
        const liq = parseFloat(awayWinMarket.liquidity) / 2;
        const feeRate = feeRateOf(awayWinMarket);
        if (tokens[0]) {
          outcomeEntries.push({ label: awayTeam, tokenId: tokens[0], fallbackPrice: prices[0] ?? 0, liquidity: liq, feeRate });
          allTokenIds.push(tokens[0]);
        }
        if (tokens[1]) {
          outcomeEntries.push({ label: `Not ${awayTeam}`, tokenId: tokens[1], fallbackPrice: prices[1] ?? 0, liquidity: liq, feeRate });
          allTokenIds.push(tokens[1]);
        }
      }
    }
    if (outcomeEntries.length === 0) continue;
    matchEntries.push({ event, homeTeam, awayTeam, outcomeEntries });
  }
  const EMBEDDED_GL_TYPES = /* @__PURE__ */ new Set(["spreads", "totals"]);
  for (const event of matchEvents) {
    const teams = extractTeams(event.title, league.polymarket.titleOrdering);
    if (!teams) continue;
    const [rawHome, rawAway] = teams;
    const homeTeam = canonicalTeamName(rawHome, league.sport);
    const awayTeam = canonicalTeamName(rawAway, league.sport);
    const startTime = startTimeFromEvent(event);
    for (const subMarket of event.markets) {
      if (!EMBEDDED_GL_TYPES.has(subMarket.sportsMarketType ?? "")) continue;
      const parsed2 = parseGameLineSubMarket(subMarket, league.sport, feeRateOf(subMarket));
      if (!parsed2) continue;
      allTokenIds.push(parsed2.tokenOne, parsed2.tokenTwo);
      glItems.push({
        homeTeam,
        awayTeam,
        polyEventId: event.id,
        conditionId: subMarket.conditionId,
        betType: parsed2.betType,
        line: parsed2.line,
        startTime,
        labelOne: parsed2.labelOne,
        labelTwo: parsed2.labelTwo,
        tokenOne: parsed2.tokenOne,
        tokenTwo: parsed2.tokenTwo,
        fallbackOne: parsed2.fallbackOne,
        fallbackTwo: parsed2.fallbackTwo,
        liquidityEach: parsed2.liquidityEach,
        feeRate: parsed2.feeRate
      });
    }
  }
  for (const event of gameLinesRaw) {
    if (!isGameLinesEvent(event.title)) continue;
    const teams = extractTeams(event.title, league.polymarket.titleOrdering);
    if (!teams) continue;
    const [rawHome, rawAway] = teams;
    const homeTeam = canonicalTeamName(rawHome, league.sport);
    const awayTeam = canonicalTeamName(rawAway, league.sport);
    const startTime = startTimeFromEvent(event);
    for (const subMarket of event.markets) {
      const parsed2 = parseGameLineSubMarket(subMarket, league.sport, feeRateOf(subMarket));
      if (!parsed2) continue;
      allTokenIds.push(parsed2.tokenOne, parsed2.tokenTwo);
      glItems.push({
        homeTeam,
        awayTeam,
        polyEventId: event.id,
        conditionId: subMarket.conditionId,
        betType: parsed2.betType,
        line: parsed2.line,
        startTime,
        labelOne: parsed2.labelOne,
        labelTwo: parsed2.labelTwo,
        tokenOne: parsed2.tokenOne,
        tokenTwo: parsed2.tokenTwo,
        fallbackOne: parsed2.fallbackOne,
        fallbackTwo: parsed2.fallbackTwo,
        liquidityEach: parsed2.liquidityEach,
        feeRate: parsed2.feeRate
      });
    }
  }
  for (const entry of matchEntries) {
    for (const oe of entry.outcomeEntries) {
      polymarketBookCache.setFeeRate(oe.tokenId, oe.feeRate);
      polymarketOddsCache.setFeeRate(oe.tokenId, oe.feeRate);
    }
  }
  for (const gl of glItems) {
    polymarketBookCache.setFeeRate(gl.tokenOne, gl.feeRate);
    polymarketBookCache.setFeeRate(gl.tokenTwo, gl.feeRate);
    polymarketOddsCache.setFeeRate(gl.tokenOne, gl.feeRate);
    polymarketOddsCache.setFeeRate(gl.tokenTwo, gl.feeRate);
  }
  const bookMap = await fetchClobBooksForTokens(allTokenIds);
  const quotes = [];
  for (const entry of matchEntries) {
    const outcomes = [];
    for (const oe of entry.outcomeEntries) {
      const o = buildOutcomeFromBook(oe.label, bookMap.get(oe.tokenId), oe.fallbackPrice, oe.liquidity, oe.feeRate);
      o.externalId = oe.tokenId;
      outcomes.push(o);
    }
    quotes.push({
      platform: "polymarket",
      externalId: entry.event.id,
      sport: league.sport,
      league: league.name,
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      name: `${entry.homeTeam} vs ${entry.awayTeam}`,
      startTime: startTimeFromEvent(entry.event),
      betType: league.hasDraw ? "1x2" : "12",
      polyEventId: entry.event.id,
      outcomes
    });
  }
  for (const gl of glItems) {
    const outcomeOne = buildOutcomeFromBook(gl.labelOne, bookMap.get(gl.tokenOne), gl.fallbackOne, gl.liquidityEach, gl.feeRate);
    outcomeOne.externalId = gl.tokenOne;
    const outcomeTwo = buildOutcomeFromBook(gl.labelTwo, bookMap.get(gl.tokenTwo), gl.fallbackTwo, gl.liquidityEach, gl.feeRate);
    outcomeTwo.externalId = gl.tokenTwo;
    quotes.push({
      platform: "polymarket",
      externalId: gl.conditionId,
      sport: league.sport,
      league: league.name,
      homeTeam: gl.homeTeam,
      awayTeam: gl.awayTeam,
      name: `${gl.homeTeam} vs ${gl.awayTeam}`,
      startTime: gl.startTime,
      betType: gl.betType,
      line: gl.line,
      mainLine: false,
      polyEventId: gl.polyEventId,
      outcomes: [outcomeOne, outcomeTwo]
    });
  }
  const glCount = quotes.filter((q) => q.betType !== "1x2").length;
  log2.info(
    { league: league.name, total: quotes.length, oneXTwo: quotes.length - glCount, gameLines: glCount, booksFetched: bookMap.size, booksRequested: allTokenIds.length },
    "fetched quotes"
  );
  const sampleConditionId = matchEntries[0]?.event.markets[0]?.conditionId ?? glItems[0]?.conditionId;
  if (sampleConditionId) {
    void smokeCheckSportsFeeRate(sampleConditionId);
  }
  return quotes;
}

// ../bot/src/router/canonicalize.ts
function canonicalize(label, betType, homeTeam, awayTeam) {
  const lbl = label.trim();
  if (betType === "1x2") {
    if (lbl === homeTeam) return { parts: { key: "1x2:home", betType, side: "home", line: null } };
    if (lbl === "Draw") return { parts: { key: "1x2:draw", betType, side: "draw", line: null } };
    if (lbl === awayTeam) return { parts: { key: "1x2:away", betType, side: "away", line: null } };
    if (lbl === `Not ${homeTeam}`) return { parts: { key: "1x2:not_home", betType, side: "not_home", line: null } };
    if (lbl === "Not Draw") return { parts: { key: "1x2:not_draw", betType, side: "not_draw", line: null } };
    if (lbl === `Not ${awayTeam}`) return { parts: { key: "1x2:not_away", betType, side: "not_away", line: null } };
    return { parts: null, reason: "1x2 label did not match home/draw/away/negations" };
  }
  if (betType === "12") {
    if (lbl === homeTeam) return { parts: { key: "12:home", betType, side: "home", line: null } };
    if (lbl === awayTeam) return { parts: { key: "12:away", betType, side: "away", line: null } };
    return { parts: null, reason: "12 label did not match home/away" };
  }
  if (betType === "spread") {
    const m = lbl.match(/^(.+?)\s+([+-]?\d+(?:\.\d+)?)$/);
    if (!m) return { parts: null, reason: "spread label did not parse" };
    const teamPart = m[1].trim();
    const handicap = parseFloat(m[2]);
    let side;
    if (teamPart === homeTeam) side = "home";
    else if (teamPart === awayTeam) side = "away";
    else return { parts: null, reason: `spread team prefix "${teamPart}" not home/away` };
    const v = handicap === 0 ? 0 : handicap;
    const norm = v > 0 ? `+${v}` : `${v}`;
    return { parts: { key: `spread:${side}:${norm}`, betType, side, line: v } };
  }
  if (betType === "total") {
    const m = lbl.match(/^(Over|Under)\s+(\d+(?:\.\d+)?)$/i);
    if (!m) return { parts: null, reason: "total label did not parse" };
    const dir = m[1].toLowerCase();
    const magnitude = parseFloat(m[2]);
    return { parts: { key: `total:${dir}:${magnitude}`, betType, side: dir, line: magnitude } };
  }
  return { parts: null, reason: `unknown betType ${betType}` };
}

// ../bot/src/public/buildMarkets.ts
var SIX_HOURS_MS = 6 * 60 * 60 * 1e3;
function eventKeyFor(home, away, sport, league, startTime) {
  const teamKey = [home, away].sort().join("\0");
  const bucket = Math.floor(startTime.getTime() / SIX_HOURS_MS);
  return `${sport}${league}${teamKey}${bucket}`;
}
function buildOverlaidMarkets(sxQuotes, polyQuotes, now = /* @__PURE__ */ new Date()) {
  const events = /* @__PURE__ */ new Map();
  const ingest = (quote) => {
    if (!quote.homeTeam || !quote.awayTeam) return;
    const home = canonicalTeamName(quote.homeTeam, quote.sport);
    const away = canonicalTeamName(quote.awayTeam, quote.sport);
    const key = eventKeyFor(home, away, quote.sport, quote.league, quote.startTime);
    const isSx = quote.platform === "sx";
    let agg = events.get(key);
    if (!agg) {
      agg = {
        key,
        sport: quote.sport,
        league: quote.league,
        home,
        away,
        startTime: quote.startTime,
        sxEventId: quote.sxEventId ?? null,
        quotes: [],
        resolvedBySx: isSx
      };
      events.set(key, agg);
    } else if (isSx && !agg.resolvedBySx) {
      agg.home = home;
      agg.away = away;
      agg.startTime = quote.startTime;
      agg.resolvedBySx = true;
    }
    if (isSx && quote.sxEventId && !agg.sxEventId) agg.sxEventId = quote.sxEventId;
    agg.quotes.push(quote);
  };
  for (const q of sxQuotes) ingest(q);
  for (const q of polyQuotes) ingest(q);
  const lastUpdated = now.toISOString();
  const out = [];
  for (const agg of events.values()) {
    const name = `${agg.home} vs ${agg.away}`;
    const startTime = agg.startTime.toISOString();
    for (const quote of agg.quotes) {
      const outcomes = quote.outcomes.map((o) => {
        const result = canonicalize(o.label, quote.betType, agg.home, agg.away);
        return {
          id: `${quote.platform}:${quote.externalId}:${o.label}`,
          label: o.label,
          platform: quote.platform,
          externalId: o.externalId ?? void 0,
          impliedOdds: o.impliedOdds,
          availableSize: o.liquidityDepth.availableSize,
          lastUpdated,
          canonicalKey: result.parts?.key ?? null
        };
      });
      out.push({
        id: `${quote.platform}:${quote.externalId}`,
        eventId: agg.key,
        platform: quote.platform,
        externalId: quote.externalId,
        sport: agg.sport,
        league: agg.league,
        homeTeam: agg.home,
        awayTeam: agg.away,
        name,
        startTime,
        status: "active",
        betType: quote.betType,
        line: quote.line ?? null,
        mainLine: quote.mainLine ?? true,
        sxEventId: agg.sxEventId,
        fixtureState: null,
        outcomes
      });
    }
  }
  return out;
}

// ../bot/src/public/fetchMarkets.ts
var PUBLIC_LEAGUES = [
  EPL,
  UCL,
  UEL,
  COPA_LIBERTADORES,
  LA_LIGA,
  SERIE_A,
  BUNDESLIGA,
  EREDIVISIE,
  LIGUE_1,
  NBA,
  MLB,
  NHL
];
async function fetchPublicMarkets(now = /* @__PURE__ */ new Date()) {
  const sxFetches = PUBLIC_LEAGUES.map(
    (league) => fetchSxBetMarkets(league).catch(() => [])
  );
  const polyFetches = PUBLIC_LEAGUES.map((league) => {
    if (!league.polymarket) return Promise.resolve([]);
    return fetchPolymarketMarkets(league).catch(() => []);
  });
  const [sxResults, polyResults] = await Promise.all([
    Promise.all(sxFetches),
    Promise.all(polyFetches)
  ]);
  return buildOverlaidMarkets(sxResults.flat(), polyResults.flat(), now);
}

// serverless/markets.ts
async function handler(_req, res) {
  try {
    const markets = await fetchPublicMarkets();
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(markets);
  } catch (err) {
    console.error("[api/markets] fetch failed", err);
    res.status(500).json({ error: "internal_server_error" });
  }
}
