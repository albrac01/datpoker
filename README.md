# DAT pokert wat

Planning poker voor je team, gemaakt voor de telefoon. Je kiest een kaart, draait de kaarten om en gaat door naar de volgende story. Teamgenoten doen mee via een link of QR-code en hebben geen account nodig.

## Wat de app doet

- **Team aanmaken**: je vult je naam en een teamnaam in en krijgt een link en een QR-code om te delen.
- **Meedoen**: wie de link opent, vult zijn naam in. De naam wordt op het toestel onthouden.
- **Stemmen**: met de kaarten 0, 1, 2, 3, 5, 8, 13, 21 en `?`. Je ziet wie al gestemd heeft, maar niet wat.
- **Omdraaien**: je ziet het gemiddelde, de mediaan en een voorstel (de kaart die het dichtst bij het gemiddelde ligt).
- **Consensusfeestje**: kiest iedereen hetzelfde, dan valt er confetti en trilt de telefoon.
- **Microfoontje**: wie flink afwijkt, mag uitleggen. Er zijn maximaal twee microfoons, en de grootste groep hoeft nooit uit te leggen.
- **Duwtje**: tik op iemand die nog niet gestemd heeft. Alleen jij en die persoon merken het.
- **Afronden**: alleen degene die het team heeft aangemaakt kan afronden.
  - Vanaf 3 rondes volgt een prijsuitreiking: Gedachtelezer, Optimist, Doemdenker, Snelste vinger en Twijfelaar.
  - Bij minder rondes zie je een overzicht van de rondes.
- **Teamnaam wijzigen**: kan alleen de aanmaker, door op de naam te tikken.
- **Feestthema's**: kiest de app automatisch op datum: Sinterklaas, Kerst, Oud en nieuw, Valentijn, 1 april, Pasen, Koningsdag en Halloween. Je kunt ze uitzetten of vooraf bekijken via **Thema**.
- **Licht en donker**: standaard licht, met een knop voor donker. De keuze wordt per toestel onthouden.
- **Aantal spelers**: 2 tot 12 per team. Tot 6 spelers staan op één rij; daarboven komt er een tweede rij bij. Alles past altijd op één scherm.

## Lokaal draaien

```bash
npm install
npm run dev
```

Zonder Firebase-instellingen draait de app in **demomodus**. Alles blijft dan in je eigen browser. Open de teamlink in een tweede tabblad om als teamgenoot mee te doen.

## Live zetten op Netlify (ongeveer 10 minuten)

Netlify host de app. Voor het live samen stemmen gebruikt de app Firebase Realtime Database. Het gratis Spark-abonnement van Firebase is voldoende: maximaal 100 mensen tegelijk, verdeeld over alle teams.

### Stap 1: Firebase-project aanmaken

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com) en maak een project aan. Google Analytics is niet nodig.
2. Ga naar **Build > Authentication > Get started** en zet onder *Sign-in method* de optie **Anonymous** aan.
3. Ga naar **Build > Realtime Database > Create database**.
   - Kies **Belgium (europe-west1)**, zodat de gegevens in de EU blijven.
   - Start in **locked mode**.
4. Open het tabblad **Rules**, vervang de inhoud door die van `database.rules.json` uit dit project en klik op **Publish**.
5. Ga naar **Project settings > General > Your apps** en klik op het web-icoon `</>`. Registreer de app; Firebase Hosting is niet nodig.
6. Je ziet nu een `firebaseConfig`. Houd die bij de hand voor stap 2.

### Stap 2: Netlify koppelen

1. Zet deze map in een Git-repository, bijvoorbeeld op GitHub.
2. Kies in Netlify **Add new project > Import an existing project** en selecteer de repository. De build-instellingen staan al in `netlify.toml`.
3. Ga naar **Project configuration > Environment variables** en voeg deze vijf variabelen toe:

   | Variabele | Waarde uit `firebaseConfig` |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

4. Ga naar **Deploys > Trigger deploy**. De variabelen worden tijdens het bouwen in de app gezet, dus na elke wijziging moet je opnieuw deployen.
5. Voeg in Firebase onder **Authentication > Settings > Authorized domains** je Netlify-adres toe, bijvoorbeeld `dat-pokert-wat.netlify.app`.
6. Open de site, maak een team aan en open de link op een tweede telefoon om te testen.

De Firebase-`apiKey` is geen geheim; die zit altijd in de app zelf. De beveiliging zit in `database.rules.json`:
- Alleen ingelogde (anonieme) gebruikers kunnen lezen.
- Je kunt alleen je eigen stem schrijven.
- Alleen de aanmaker kan de teamnaam wijzigen en afronden.
- Een duwtje is alleen leesbaar voor degene die het krijgt.

### Stap 3: de Netlify-badge controleren

Nieuwe projecten op het gratis Netlify-abonnement tonen rechtsonder een badge "Powered by Netlify".
- Kijk onder **Project configuration > General > Powered by Netlify badge** of je hem kunt uitzetten.
- Is die instelling vergrendeld, dan kan de badge over de `?`-kaart vallen. Bezoekers kunnen hem zelf verbergen via "Hide this badge", of je stapt over naar een betaald Netlify-abonnement.

## Projectstructuur

```
index.html            alle schermen: aanmaken, delen, meedoen, tafel
src/main.ts           de app: schermen, stemmen, omdraaien, duwtjes, afronden
src/style.css         vormgeving (licht, donker, telefoonkader op grote schermen)
src/lib/game.ts       uitslag, microfoonregels, prijsuitreiking
src/lib/themes.ts     feestthema's en het feestje
src/lib/sync/         realtime-laag: firebase.ts (live) en demo.ts (lokaal testen)
database.rules.json   beveiligingsregels voor Firebase
netlify.toml          build-instellingen voor Netlify
```

### Gegevens in Firebase

```
rooms/{code}/
  meta        teamnaam, aanmaker, afgerond
  players     {uid}: naam, online
  round       ronde-id, omgedraaid, microfoons
  votes       {uid}: kaart + ronde-id
  history     uitslag per ronde (voor de prijsuitreiking)
nudges/{code}/{uid}   duwtjes, alleen leesbaar voor de ontvanger
```

## Goed om te weten

- **Stemmen zijn tot het omdraaien alleen in de app verborgen.** Wie technisch onderlegd is, kan ze via de ontwikkelaarstools eerder zien. Voor scrum poker is dat meestal geen probleem.
- **Iedereen met de link kan meedoen.** Deel de link dus alleen met je team.
- **Oude teams blijven in de database staan.** Wil je opruimen, verwijder dan af en toe de mappen `rooms` en `nudges` in de Firebase-console.
