# Ochrana soukromí

## Údaje na stránce

Rozšíření a bookmarklet čtou ČSFD ID, typ filmu, název, dostupný rok, režii a případný odkaz na IMDb z už otevřené stránky filmu. Údaje slouží k sestavení odkazu a k vyhledání odpovídajícího titulu. Projekt nemá vlastní backend, analytiku ani účet.

## Externí služby

- **Wikimedia.** Když zvolená akce vyžaduje Wikidata, klient pošle ČSFD ID filmu jako součást SPARQL dotazu na `query-next.wikidata.org`. Používá HTTPS, `credentials: omit` a `referrerPolicy: no-referrer`. Wikimedia obdrží běžná síťová metadata, například IP adresu a údaje HTTP klienta. [Zásady ochrany soukromí Wikimedia](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy)
- **Letterboxd.** Prohlížeč otevře film podle identifikátoru filmu nebo předá hledaný název a dostupný rok v adrese vyhledávání. Na návštěvu Letterboxd se vztahují jeho zásady. [Zásady soukromí Letterboxd](https://letterboxd.com/legal/privacy-notice/)

## Lokální uložení

Rozšíření ukládá nastavení a kladná mapování v `chrome.storage.local`. Záznam obsahuje ČSFD ID, identifikátory, zdroj a čas získání. Záznamy jsou platné 30 dní a lze je kdykoli vymazat. Nastavení umožňuje ukládání mapování vypnout. Informace o čase povoleného dalšího dotazu při omezení služby zůstává v paměti relace prohlížeče. Bookmarklet trvalé úložiště nepoužívá.

Kontaktní údaje správce doplní vlastník před zveřejněním.
