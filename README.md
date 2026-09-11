# Yatzy-kirjanpito

Mobiilille sopiva, jaettavalla linkillä toimiva Yatzy-pisteiden seuranta.

## Firebase-pystytys

1. Avaa [Firebase Console](https://console.firebase.google.com/) ja luo projekti.
2. Lisää projektiin Web-sovellus (</>), mutta älä ota Hostingia vielä käyttöön.
3. Valitse **Databases & Storage -> Realtime Database -> Create Database**. Valitse sijainti ja aloita lukitussa tilassa.
4. Valitse **Build -> Authentication -> Sign-in method** ja ota **Anonymous** käyttöön.
5. Kopioi Web-sovelluksen asetukset tiedostoon `firebase-config.js`.
6. Jos tietokannan osoite ei ole oletusarvoinen, kopioi se Firebase Consolen Realtime Database -näkymästä `databaseURL`-arvoksi.
7. Avaa Realtime Databasen **Rules**-välilehti ja korvaa säännöt tiedoston `firebase.rules.json` sisällöllä. Valitse lopuksi **Publish**. Säännöissä ei vaadita tyhjää `scores`-haaraa pelin luontivaiheessa, koska Realtime Database ei tallenna tyhjää objektia.

Säännöt sitovat pelaajan Firebase Authenticationin käyttäjätunnukseen. Peliä voi lukea vasta liittymisen jälkeen, ja jaetun pelilinkin saanut kirjautunut käyttäjä voi lisätä peliin vain oman pelaajarivinsä. Uudet säännöt ja päivitetty selainkoodi pitää julkaista samalla kertaa; vanhalla selainkoodilla luodut keskeneräiset pelit eivät käytä Auth-tunnuksia eivätkä siksi avaudu uusilla säännöillä.

Firebase Web API -avaimen voi huoletta olla selainkoodissa. Tietoturva tehdään Authenticationilla ja Realtime Database -säännöillä, ei avaimen piilottamisella.

## Kokeilu paikallisesti

Selain estää moduulien lataamisen suoraan `file://`-osoitteesta. Käynnistä kansiossa jokin paikallinen staattinen palvelin, esimerkiksi:

```powershell
py -m http.server 8000
```

Avaa sitten <http://localhost:8000>.

## Julkaisu GitHub Pagesiin

1. Luo GitHubiin uusi repository, esimerkiksi `yatzy`.
2. Lisää nämä tiedostot repositoryyn ja pushaa ne `main`-haaraan.
3. Avaa repositorion **Settings -> Pages**.
4. Valitse **Deploy from a branch**, haaraksi `main` ja kansioksi `/ (root)`.
5. Tallenna. GitHub näyttää sivun osoitteen, jonka voi jakaa WhatsAppissa.

Firebase toimii myös GitHub Pagesin HTTPS-osoitteessa. Jos repositoryn nimi ei ole käyttäjänimi.github.io, peli käyttää GitHub Pagesin projektipolkua automaattisesti, koska linkki kopioidaan selaimen nykyisestä osoitteesta.
