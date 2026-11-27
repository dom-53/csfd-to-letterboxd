# ČSFD - Letterboxd Link

Nezávislé rozšíření pro Chrome a bookmarklet, které ze stránky filmu na ČSFD otevřou odpovídající film na Letterboxd.

**[Instalační web pro Bookmarklet namísto rozšíření](https://dom-53.github.io/csfd-to-letterboxd/)**

## Instalace

Rozšíření vyžaduje Chrome 126 nebo novější.

### Instalace z Chrome Web Store

Otevřete [stránku rozšíření v Chrome Web Store](https://chromewebstore.google.com/detail/jekombdogpinpimpiaboddbjfmflaibg), klikněte na **Přidat do Chromu** a potvrďte instalaci.

### Ruční instalace rozšíření

1. Rozbalte ZIP rozšíření nebo sestavte složku `dist/extension/` ze zdrojového kódu podle pokynů v sekci [Vývoj](#vývoj).
2. Otevřete `chrome://extensions` a zapněte **Režim pro vývojáře**.
3. Klikněte na **Načíst rozbalené** a vyberte složku, ve které je `manifest.json`.
4. Otevřete stránku filmu na ČSFD a klikněte na **Letterboxd** pod názvem filmu.

### Bookmarklet

1. Otevřete [instalační web](https://dom-53.github.io/csfd-to-letterboxd/) po nasazení na GitHub Pages nebo si spusťte místní náhled příkazem `npm run dev` po instalaci závislostí.
2. Přetáhněte odkaz **Otevřít na Letterboxd** do lišty záložek. Při ruční instalaci vložte do adresy nové záložky celý kód včetně předpony `javascript:`.
3. Otevřete film na ČSFD a klikněte na uloženou záložku. Letterboxd se otevře ve stejné záložce.

Samostatný build bookmarkletu uloží kód do `dist/bookmarklet/bookmarklet.txt`.

## Nastavení rozšíření

Režim vyhledání a motiv změníte v popupu. V úplném nastavení můžete zapnout vyhledávání při chybějící shodě, spravovat místní cache a vybrat, kde se odkaz otevře.

| Režim | Jak najde film |
| --- | --- |
| Automaticky | IMDb odkaz ze stránky ČSFD → místní cache → Wikidata → vyhledávání |
| Pouze ČSFD | IMDb odkaz z právě otevřené stránky |
| Pouze Wikidata | Mapování z Wikidata uložené v cache → Wikidata |
| Pouze vyhledávání | Vyhledávání na Letterboxd podle názvu a dostupného roku |

U prvních tří režimů lze vyhledávání při chybějící shodě vypnout. Ve výchozím nastavení je zapnuté a odkaz se otevře v nové záložce. Místní cache uchovává až 2 000 nalezených mapování, každé po dobu 30 dní. V nastavení ji lze vypnout nebo vymazat.

Motiv má volby **Automaticky**, **Světlý** a **Tmavý**. Při automatické volbě tlačítko přebírá vzhled ČSFD a okna rozšíření motiv systému.

## Soukromí

Údaje o filmu se čtou z otevřené stránky ČSFD. Pokud je po kliknutí potřeba dotaz na Wikidata, obsahuje pouze ČSFD ID filmu. Vyhledávací odkaz na Letterboxd obsahuje název a případně rok. Projekt funguje bez vlastního serveru, registrace a analytiky. [Podrobnosti o ochraně soukromí](PRIVACY.md)

## Vývoj

Použijte Node.js 24 LTS nebo Node.js 22 od verze 22.12. Nainstalujte závislosti z lockfilu a sestavte rozšíření.

```sh
npm ci
npm run build:extension
```

| Příkaz | Výsledek |
| --- | --- |
| `npm run dev` | Místní instalační web |
| `npm run lint` | Statická kontrola kódu |
| `npm run typecheck` | Typová kontrola TypeScriptu |
| `npm test` | Testy parseru, vyhledání filmu, cache a rozšíření |
| `npm run build:extension` | Rozšíření ve složce `dist/extension/` |
| `npm run build:bookmarklet` | Hotový bookmarklet v `dist/bookmarklet/` |
| `npm run build:site` | Statický web v `dist/site/` |
| `npm run package:extension` | Ověřený ZIP rozšíření v `dist/` |
| `npm run verify:wikidata` | Živá kontrola mapování pro Přepadení vlaku a Cestu na Měsíc |

Rozšíření i bookmarklet sdílejí parser ČSFD, sestavování odkazů a logiku vyhledání v `src/core/`. Přímý odkaz z Wikidata se vybírá v pořadí identifikátor Letterboxd, IMDb a TMDB. Při rozporných výsledcích se postupuje podle nastavení vyhledávání při chybějící shodě.

Pro změny parseru přiložte minimální testovací HTML. Změny vyhledávání ověřujte se simulovanými síťovými odpověďmi. Syntetická ukázka používá **Přepadení vlaku (1903)**, které Library of Congress řadí mezi volná díla v USA. [Library of Congress](https://www.loc.gov/free-to-use/public-domain-films-from-the-national-film-registry/)

## Vydání

Workflow **Checks** spouští kontroly a připravuje ZIP, bookmarklet a web jako artefakty. Tag `vX.Y.Z` ověří shodu s verzí projektu. Před vydáním sjednoť verzi v `package.json`, `package-lock.json` a `src/extension/manifest.json`.

Pro GitHub Pages vyber v repozitáři **Settings → Pages → Source → GitHub Actions**. Potom spusťte **Actions → Deploy GitHub Pages → Run workflow**. Proměnná `CHROME_WEB_STORE_URL` může po zveřejnění rozšíření přidat na web odkaz do obchodu.

## Licence

Projekt je vydáván pod [licencí MIT](LICENSE). Text licence je součástí ZIPu rozšíření, bookmarkletu a buildu webu. ČSFD a Letterboxd jsou názvy příslušných služeb.
