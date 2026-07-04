# CS API - Klientdokumentation

Detta dokument beskriver REST API:t som klienter använder för att läsa banor, hantera mapcycle, läsa serverstatus och skicka kommandon till en Counter-Strike 2-server.

## Basinformation

Bas-URL beror på miljö:

```text
http://localhost:8080
```

Alla API-endpoints ligger under:

```text
/api/v1
```

API-specifikation finns även som OpenAPI:

```http
GET /v3/api-docs
GET /swagger-ui.html
```

## Autentisering

Alla `/api/v1/*` endpoints kräver API-nyckel.

Rekommenderad header:

```http
Authorization: Bearer <api-key>
```

Alternativ header:

```http
X-API-Key: <api-key>
```

Exempel:

```bash
curl -H 'Authorization: Bearer dev-secret-change-me' \
  http://localhost:8080/api/v1/maps
```

## Felformat

Fel returneras som JSON.

```json
{
  "timestamp": "2026-06-03T20:15:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Unknown map id: de_unknown",
  "path": "/api/v1/mapcycle"
}
```

Vanliga HTTP-statusar:

```text
400 Bad Request      Ogiltig request, okänd bana eller ogiltigt kommando
401 Unauthorized     API-nyckel saknas eller är fel
403 Forbidden        API-nyckeln saknar rättighet
502 Bad Gateway      RCON-problem, t.ex. fel lösenord eller anslutningsfel
504 Gateway Timeout  RCON timeout
```

## Banor

### Lista banor

```http
GET /api/v1/maps
```

Kräver scope:

```text
maps:read
```

Exempel:

```bash
curl -H 'Authorization: Bearer dev-secret-change-me' \
  http://localhost:8080/api/v1/maps
```

Svar:

```json
[
  {
    "id": "de_mirage",
    "name": "de_mirage",
    "displayName": "de_mirage",
    "source": "BUILTIN",
    "workshopId": null,
    "validForMapCycle": true
  },
  {
    "id": "workshop:3674217330",
    "name": "3674217330",
    "displayName": "Aim Botz - Training",
    "source": "WORKSHOP",
    "workshopId": "3674217330",
    "validForMapCycle": false
  }
]
```

Fält:

```text
id                 Stabilt id som klienten skickar tillbaka till API:t
name               Tekniskt namn
displayName        Namn som bör visas i UI
source             BUILTIN eller WORKSHOP
workshopId         Steam Workshop-id, endast för WORKSHOP
validForMapCycle   true om banan får sparas i mapcycle.txt
```

Viktiga regler:

```text
BUILTIN-banor kan användas i mapcycle.txt.
WORKSHOP-banor kan bytas till med CHANGE_MAP, men kan inte användas i mapcycle.txt.
Klienten ska inte använda filsystemssökvägar. API:t exponerar inga paths.
```

## Mapcycle

### Hämta mapcycle

```http
GET /api/v1/mapcycle
```

Kräver scope:

```text
mapcycle:read
```

Exempel:

```bash
curl -H 'Authorization: Bearer dev-secret-change-me' \
  http://localhost:8080/api/v1/mapcycle
```

Svar:

```json
{
  "maps": [
    "de_mirage",
    "de_inferno"
  ]
}
```

### Ersätt mapcycle

```http
PUT /api/v1/mapcycle
```

Kräver scope:

```text
mapcycle:write
```

Request body:

```json
{
  "maps": [
    "de_mirage",
    "de_inferno"
  ]
}
```

Exempel:

```bash
curl -X PUT \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"maps":["de_mirage","de_inferno"]}' \
  http://localhost:8080/api/v1/mapcycle
```

Svar:

```json
{
  "maps": [
    "de_mirage",
    "de_inferno"
  ]
}
```

Regler:

```text
Alla map-id:n måste finnas i GET /api/v1/maps.
Listan får inte innehålla dubbletter.
Endast banor med validForMapCycle=true får skickas.
WORKSHOP-banor nekas.
```

Exempel på ogiltig request:

```json
{
  "maps": [
    "workshop:3674217330"
  ]
}
```

Exempel på felsvar:

```json
{
  "timestamp": "2026-06-03T20:15:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Map cannot be used in mapcycle.txt: workshop:3674217330",
  "path": "/api/v1/mapcycle"
}
```

## Serverstatus

### Hämta status

```http
GET /api/v1/server/status
```

Kräver scope:

```text
status:read
```

Exempel:

```bash
curl -H 'Authorization: Bearer dev-secret-change-me' \
  http://localhost:8080/api/v1/server/status
```

Svar:

```json
{
  "online": true,
  "currentMap": "de_mirage",
  "playerCount": 2,
  "maxPlayers": 12,
  "players": [
    {
      "name": "Player One",
      "steamId": "76561198000000001",
      "score": 14,
      "durationSeconds": 523
    },
    {
      "name": "Player Two",
      "steamId": "76561198000000002",
      "score": 9,
      "durationSeconds": 411
    }
  ]
}
```

Om servern inte kan läsas kan svaret vara:

```json
{
  "online": false,
  "currentMap": null,
  "playerCount": 0,
  "maxPlayers": 0,
  "players": []
}
```

## Serverkommandon

### Skicka kommando

```http
POST /api/v1/server/commands
```

Kräver scope:

```text
commands:execute
```

Request body:

```json
{
  "type": "CHANGE_MAP",
  "arguments": {
    "map": "de_mirage"
  }
}
```

Svar:

```json
{
  "type": "CHANGE_MAP",
  "accepted": true,
  "message": "RCON command executed"
}
```

### CHANGE_MAP

Byter bana.

Inbyggd bana:

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"CHANGE_MAP","arguments":{"map":"de_mirage"}}' \
  http://localhost:8080/api/v1/server/commands
```

Workshop-bana:

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"CHANGE_MAP","arguments":{"map":"workshop:3674217330"}}' \
  http://localhost:8080/api/v1/server/commands
```

Regel:

```text
map måste vara ett id från GET /api/v1/maps.
```

### RESTART_MATCH

Startar om matchen.

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"RESTART_MATCH"}' \
  http://localhost:8080/api/v1/server/commands
```

### TOGGLE_PAUSE

Växlar pausläge för aktuell match.

Klienten skickar alltid samma kommando. Servern håller reda på senaste pausläge och skickar RCON-kommandot `mp_pause_match` vid första anropet, `mp_unpause_match` vid nästa anrop, och fortsätter sedan växla.

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"TOGGLE_PAUSE"}' \
  http://localhost:8080/api/v1/server/commands
```

Svar:

```json
{
  "type": "TOGGLE_PAUSE",
  "accepted": true,
  "message": "RCON command executed"
}
```

Klientanvisning:

```text
Visa en knapp eller toggle för paus.
Skicka TOGGLE_PAUSE varje gång användaren vill växla pausläge.
Skicka inte pause=true eller pause=false; kommandot har inga argument.
Efter kartbyte eller matchrestart antar servern att matchen inte är pausad.
```

### BOTCONTROL

Styr hur många bottar som används i spelet.

Det finns två lägen:

```text
static   Sätter ett fast antal bottar med bot_quota.
dynamic  Använder serverns botcontrol-kommando för on/off/status/min/max.
```

#### BOTCONTROL static

Sätter antalet bottar statiskt.

Request:

```json
{
  "type": "BOTCONTROL",
  "arguments": {
    "type": "static",
    "bots": 8
  }
}
```

Regler:

```text
bots måste vara ett heltal mellan 0 och 24.
```

Exempel:

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"BOTCONTROL","arguments":{"type":"static","bots":8}}' \
  http://localhost:8080/api/v1/server/commands
```

#### BOTCONTROL dynamic on/off

Slår på eller av dynamisk botkontroll.

Request:

```json
{
  "type": "BOTCONTROL",
  "arguments": {
    "type": "dynamic",
    "command": "on"
  }
}
```

`command` kan vara:

```text
on
off
```

on stänger av static.
off sätter bot_quota till 0.

Exempel:

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"on"}}' \
  http://localhost:8080/api/v1/server/commands
```

#### BOTCONTROL dynamic status

Hämtar aktuell dynamisk botkontrollstatus.

Request:

```json
{
  "type": "BOTCONTROL",
  "arguments": {
    "type": "dynamic",
    "command": "status"
  }
}
```

Exempel på svar:

```json
{
  "type": "BOTCONTROL",
  "accepted": true,
  "message": "Bot Control is ON. Min: 6. Max: 10"
}
```

#### BOTCONTROL dynamic min/max

Ändrar minsta eller största antal bottar för dynamisk botkontroll.

Request för min:

```json
{
  "type": "BOTCONTROL",
  "arguments": {
    "type": "dynamic",
    "command": "min",
    "bots": 6
  }
}
```

Request för max:

```json
{
  "type": "BOTCONTROL",
  "arguments": {
    "type": "dynamic",
    "command": "max",
    "bots": 10
  }
}
```

Regler:

```text
bots måste vara ett heltal mellan 1 och 24.
min måste vara lägre än aktuell max.
max måste vara högre än aktuell min.
```

Exempel:

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"BOTCONTROL","arguments":{"type":"dynamic","command":"max","bots":10}}' \
  http://localhost:8080/api/v1/server/commands
```

### SAY

Skickar ett servermeddelande.

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"SAY","arguments":{"message":"Matchen startar om om 10 sekunder"}}' \
  http://localhost:8080/api/v1/server/commands
```

### EXEC_CONFIG

Kör en serverconfig.

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"EXEC_CONFIG","arguments":{"config":"practice.cfg"}}' \
  http://localhost:8080/api/v1/server/commands
```

Regler:

```text
config får inte vara tom.
config får inte vara en absolut sökväg.
config får inte innehålla ..
```

### RAW_RCON

Skickar ett rått RCON-kommando.

Kräver extra scope:

```text
admin:rcon
```

Exempel:

```bash
curl -X POST \
  -H 'Authorization: Bearer dev-secret-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"type":"RAW_RCON","arguments":{"command":"status"}}' \
  http://localhost:8080/api/v1/server/commands
```

Använd detta sparsamt. Klienter bör normalt använda de typade kommandona ovan.

## Command Types

Tillåtna `type`-värden:

```text
CHANGE_MAP
RESTART_MATCH
TOGGLE_PAUSE
BOTCONTROL
SAY
EXEC_CONFIG
RAW_RCON
```

Argument:

```text
CHANGE_MAP     arguments.map
RESTART_MATCH  inga argument krävs
TOGGLE_PAUSE   inga argument krävs
BOTCONTROL     arguments.type, samt arguments.command/bots beroende på läge
SAY            arguments.message
EXEC_CONFIG    arguments.config
RAW_RCON       arguments.command
```

## Scopes

API-nycklar kan begränsas med scopes.

```text
maps:read          GET /api/v1/maps
mapcycle:read      GET /api/v1/mapcycle
mapcycle:write     PUT /api/v1/mapcycle
status:read        GET /api/v1/server/status
commands:execute   POST /api/v1/server/commands
admin:rcon         Krävs för RAW_RCON
```
