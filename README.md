# Pissarra

Una pissarra blanca virtual inspirada en [Excalidraw](https://excalidraw.com), per fer esbossos, diagrames i esquemes amb aspecte de dibuix fet a mà.

Està feta amb **HTML, CSS i JavaScript purs**: sense frameworks ni llibreries i sense cap pas de compilació (l'única cosa externa, opcional, és una lletra de Google Fonts). Només cal obrir `index.html` al navegador.

---

## Característiques

**Dibuix**
- Rectangles (cantonades rectes o arrodonides), rombes i el·lipses.
- Fletxes i línies; es poden corbar afegint punts intermedis.
- Llapis a mà alçada.
- Text de diverses línies, amb tres tipus de lletra (a mà, normal i de codi), quatre mides i alineació.
- **Pòsits** (notes adhesives, `N`): un clic crea un pòsit de 200 × 200 i ja s'hi pot escriure; arrossegant, se'n tria la mida. El text salta de línia sol per ajustar-se a l'amplada i, si no hi cap, el pòsit s'allarga cap avall (no s'encongeix sol: es pot fer més petit amb les nanses fins on hi càpiga el text). Per tornar-lo a editar: doble clic, `Retorn` o «Edita el text» del menú contextual. El color del pòsit és el **Fons** del panell (groc per defecte; no pot ser transparent) i el text fa servir el color del **Traç**, el tipus de lletra, la mida i l'alineació del text. Es poden moure, girar, agrupar, enganxar-hi fletxes, pintar amb el pot i exportar com qualsevol altre element. Un pòsit buit no s'esborra.
- Imatges: des del botó, arrossegant un fitxer o enganxant-les del porta-retalls.
- **Enllaços als elements** (com a l'Excalidraw): selecciona un element i prem `Ctrl+K`, el botó d'enllaç de la secció «Accions» del panell o «Afegeix un enllaç…» del menú contextual. N'hi ha prou d'escriure `exemple.cat` (s'hi afegeix `https://`) o una adreça de correu (es converteix en `mailto:`); s'accepten adreces `http`, `https`, `mailto` i `tel`, i qualsevol altra cosa (com `javascript:`) es rebutja. `Retorn` o un clic fora desa, `Esc` cancel·la i deixar-lo buit el treu.
  - Els elements amb enllaç mostren un **botonet** a la cantonada superior dreta: en passar-hi per sobre se'n veu l'adreça i amb un clic (o un toc) s'obre en una pestanya nova.
  - Quan l'element està seleccionat, a sota apareix una barra amb l'adreça (clicable) i els botons per editar-la o treure-la. Al menú contextual també hi ha «Obre l'enllaç», «Edita l'enllaç…» i «Treu l'enllaç».
  - L'enllaç es desa amb el dibuix (fitxer, navegador i enllaç per compartir), es copia i es duplica amb l'element i es manté a l'exportació **SVG** (l'element és clicable). Al PNG no hi surt.
  - Cada enllaç és d'un sol element: per posar-ne un a un element d'un grup, fes doble clic al grup i tria'l.
- Goma d'esborrar.
- **Pot de pintura** (`B`): pinta els elements sobre els quals fas clic (o arrossegues) amb el color triat al panell. A «Pinta» tries si pinta el **fons** (rectangles, rombes i el·lipses, amb l'estil d'emplenat triat; n'hi ha prou de fer clic a l'interior, encara que la forma no tingui fons) o el **traç** (també línies, fletxes, llapis i text). Cada arrossegada és un sol pas de l'historial. Amb `Alt`+clic agafa el color de sota i el fa servir per pintar.
- **Comptagotes** (`I`): agafa el color d'un element (el fons, si fas clic a l'interior d'una forma amb fons; si no, el traç), d'un punt d'una imatge o, si no hi ha res, el fons de la pissarra. El color passa a ser el color de fons o de traç actual (el que faran servir el pot i les eines de dibuix) i es torna a l'eina anterior. El color agafat és el desat, no el que es veu en tema fosc, de manera que és coherent en tots dos temes.
- Amb el pot i el comptagotes, l'element que es pintarà o del qual s'agafarà el color es ressalta en passar-hi per sobre.
- Traç "a mà" generat pel propi programa, amb tres nivells: net, natural i desmanegat. Cada element té una llavor aleatòria, de manera que el dibuix no tremola quan es mou.

**Estil**
- Color del traç i del fons (paleta i color personalitzat).
- **Selector de color propi**, en lloc de la finestra del sistema (botó de l'arc de Sant Martí, «Més colors…»). Serveix per al traç, el fons dels elements i el fons de la pissarra, i té:
  - una paleta de 11 tons × 6 intensitats (colors [Open Color](https://yeun.github.io/open-color/), la mateixa família que fa servir l'Excalidraw), més transparent o «per defecte», tinta i blanc;
  - els colors recents (els últims 11, desats al navegador);
  - un quadre de saturació i brillantor amb una barra de to;
  - el codi hexadecimal (accepta `#abc` i `#aabbcc`) i una mostra de com es veurà;
  - un comptagotes per agafar el color d'un element o de la pissarra (funciona a tots els navegadors).
  
  Els canvis es veuen a l'instant i queden com un sol pas de l'historial en tancar el selector (`Esc`, la creu o un clic fora). Funciona amb ratolí, teclat (fletxes al quadre de color) i dit; al mòbil s'obre com un full a la part inferior.
- Traç transparent per als rectangles, rombes i el·lipses (per fer formes només amb fons). No s'aplica a línies, fletxes, llapis ni text, perquè quedarien invisibles. Si una forma es queda sense traç ni fons, a l'editor es mostra amb una vora discontínua tènue per poder-la trobar; aquesta vora no surt a les exportacions.
- Emplenat ratllat, quadriculat o sòlid.
- Gruix, traç continu / discontinu / puntejat i opacitat.
- **Ombres** per a qualsevol element (formes, línies, fletxes, llapis, text, pòsits i imatges): sense ombra, **suau** o **marcada**, des de la secció «Ombra» del panell o del menú contextual. S'aplica als elements seleccionats i queda com a opció per als elements nous que dibuixis després. Els pòsits en guarden una de pròpia: per defecte, ombra suau (es pot treure). L'ombra fa una sola silueta per element (fons i traç junts), surt a les exportacions PNG i SVG (en SVG, amb un filtre `feDropShadow`) i en tema fosc és més intensa perquè es vegi.

**Edició**
- Selecció individual, múltiple (Maj + clic) o per àrea.
- Moure, canviar la mida (amb Maj per mantenir les proporcions) i editar els punts de línies i fletxes.
- **Girar** qualsevol element o selecció amb la nansa rodona (amb Maj, en passos de 15°; s'enganxa suaument als angles rectes) o en passos de 90° amb els botons.
- **Invertir** horitzontalment o verticalment, respecte al centre de la selecció. Les línies, fletxes, traços de llapis i imatges es reflecteixen; el text es manté llegible.
- Desfer i refer, copiar, retallar, enganxar i duplicar (també Alt + arrossegar).
- Ordre de capes i alineació de diversos elements.
- **Agrupar i desagrupar** elements, també amb grups dins d'altres grups. Un clic selecciona tot el grup, que es mou, gira, inverteix, duplica i esborra com una sola peça. Amb doble clic s'entra dins del grup per treballar amb un element concret (o un subgrup); `Esc` o un clic fora en surten.
- Quadrícula amb ajust automàtic.
- **Color de fons de la pissarra** des del menú («Fons de la pissarra»): el del tema (per defecte), gris, paper, groc, blau, verd o un color personalitzat. Com els altres colors, s'adapta al tema: en tema fosc es converteix en un gris fosc amb un toc del mateix to. Es desa amb el dibuix (al navegador i als fitxers), s'aplica a l'exportació quan s'hi inclou el fons i s'importa dels fitxers `.excalidraw`.
- **Imatge de fons de la pissarra**, al mateix apartat del menú («Imatge de fons…»), amb tres maneres de col·locar-la:
  - **Cobreix:** omple tota la pantalla i no es mou amb el dibuix (com un fons d'escriptori).
  - **Centrada:** la imatge sencera, centrada a la pantalla.
  - **Mosaic:** es repeteix i es mou i s'amplia amb el dibuix (útil per a textures o papers quadriculats).

  Té una opacitat ajustable (10–100 %) perquè el dibuix es llegeixi bé. Per ocupar poc, la imatge es redueix a 2.048 px pel costat més llarg i es desa en JPEG si no té transparència (en PNG si en té). Es desa amb el dibuix (al navegador, als fitxers i a l'enllaç per compartir, si hi inclous les imatges), surt a l'exportació PNG i SVG quan s'hi inclou el fons (amb l'opció «Imatge de fons» es pot exportar sense, només amb el color de fons), i el comptagotes en pot agafar colors. A diferència del color de fons, la imatge no s'adapta al tema: en tema fosc, sobre una imatge clara, pot convenir baixar-ne l'opacitat o passar al tema clar.
- Moure la selecció amb les fletxes del teclat, amb un **pas configurable** des del menú («Pas de les fletxes»): 1, 5, 10, 20 o 50 píxels, o qualsevol valor d'1 a 500. Amb `Maj` es mou 10 vegades el pas, i amb la quadrícula activa, una casella. La preferència es desa al navegador.

**Vista**
- Llenç infinit amb desplaçament i zoom (roda, trackpad, Espai + arrossegar, pessic amb dos dits).
- Ajust del zoom al contingut.

**Fitxers**
- **Desament automàtic** al navegador (`localStorage`).
- **Desa a…** (`Ctrl+S`): desar el dibuix en un fitxer JSON propi o crear un **enllaç per compartir**.
  - Abans de desar el fitxer pots **triar-ne el nom** (l'extensió `.json` s'hi afegeix sola). Proposa el nom amb què es va desar o obrir el dibuix (o `pissarra-data-hora` si és nou), seleccionat perquè n'escriguis un altre directament; `Retorn` desa. Els caràcters que no es poden fer servir en noms de fitxer (`\ / : * ? " < > |`) es canvien per un guionet i el diàleg avisa de com quedarà. El nom es recorda (també en recarregar la pàgina), es mostra al títol de la pestanya i s'esborra en netejar el llenç o en obrir un enllaç compartit. On va a parar el fitxer ho decideix el navegador: normalment, la carpeta de baixades.
- Obrir dibuixos desats (`Ctrl+O` o arrossegant el fitxer a la pissarra).
- **Importació bàsica de fitxers `.excalidraw`** (vegeu les limitacions).
- Exportació a **PNG** (escala 1×, 2× o 3×) i **SVG**, amb o sense fons, amb o sense la imatge de fons (si n'hi ha), en tema clar o fosc, i de tot el dibuix o només de la selecció.
- **Exportar un element o un grup com a imatge**: amb un o més elements (o un grup) seleccionats, el botó «Exporta com a imatge» de la secció «Accions» del panell (o `Ctrl+Maj+E`) obre el diàleg d'exportació amb «Només la selecció» marcat; el diàleg indica què s'exporta («l'element», «el grup (3 elements)», «4 elements»). La imatge s'ajusta a la mida de la selecció, amb un petit marge. El fitxer es diu `pissarra-seleccio-…` o, si és un sol text, porta el text al nom (per exemple `pissarra-hola-mon-….png`).
- **Copiar la selecció com a PNG** directament al porta-retalls, sense obrir el diàleg: `Alt+Maj+C` (sense selecció, copia tot el dibuix). Fa servir el tema actual, escala 2× i les opcions de fons de l'última exportació. Alguns navegadors (o pàgines sense HTTPS) no deixen copiar imatges; llavors cal fer servir el diàleg i descarregar el PNG.
- Còpia de la imatge al porta-retalls (si el navegador ho permet).

**Interfície**
- **Tema fosc per defecte** i tema clar. El dibuix s'adapta al tema: els colors es desen en la versió clara i en tema fosc se n'inverteix la lluminositat mantenint el to.
- Adaptada a **PC, tauleta i mòbil**: al mòbil la barra d'eines baixa a la part inferior (a l'abast del polze) i les opcions d'estil s'obren en un panell amb el botó «Estil».
- **Posició de la barra d'eines**: al menú, «Barra d'eines» → **A dalt** o **A baix**. Per defecte és a dalt a l'ordinador i la tauleta, i a baix al mòbil; quan en tries una, s'aplica a totes les mides de pantalla i queda desada al navegador. A l'ordinador, a baix es col·loca al centre, al costat del zoom; si la finestra és estreta, el zoom i el desfés pugen a sobre de la barra perquè no se superposin.
- **Menú contextual** amb el **botó dret** del ratolí (o un **toc llarg** a la pantalla tàctil, o `Maj+F10` / tecla de menú amb el teclat):
  - **Sobre un element o un grup** (el selecciona si no ho estava; si hi ha una selecció de diversos elements i es fa clic dret dins el seu requadre, actua sobre tota la selecció): retalla, copia, enganxa, copia com a PNG, exporta a PNG o a SVG, agrupa o desagrupa (segons el cas), capes (envia al fons, enrere, endavant, porta al davant), alinea (amb dues unitats o més), inverteix horitzontalment o verticalment, ajusta la vista a la selecció, duplica i elimina.
  - **En un lloc buit**: enganxa (al punt on s'ha obert el menú), selecciona-ho tot, ajusta a la pantalla, desfés, refés, copia el dibuix com a PNG, exporta la imatge i quadrícula.
  - L'exportació des del menú descarrega el fitxer directament, amb el tema actual, l'escala i les opcions de fons de l'última exportació. Es pot recórrer amb les fletxes i es tanca amb `Esc`.
- Interfície en català, amb finestra d'ajuda i dreceres de teclat.

---

## Com s'utilitza

### Opció 1: obrir directament
Fes doble clic a `index.html`. Funciona des del sistema de fitxers (`file://`), sense servidor.

### Opció 2: amb un servidor local
És recomanable si vols provar-la des d'un altre dispositiu de la mateixa xarxa (per exemple, el mòbil o la tauleta):

```bash
# Amb Python 3
python3 -m http.server 8000

# o bé amb Node.js
npx serve .
```

I obre `http://localhost:8000` (o `http://IP-DEL-TEU-ORDINADOR:8000` des d'un altre dispositiu).

### Publicar-la
Com que són fitxers estàtics, es pot publicar tal qual a GitHub Pages, Netlify, Cloudflare Pages o qualsevol servidor web. Cal publicar-la si vols compartir dibuixos amb enllaços amb altres persones o dispositius (vegeu l'apartat següent).

Té favicon (un quadre lila amb un gargot i un pòsit) i un `manifest.webmanifest`, de manera que, publicada, es pot afegir a la pantalla d'inici del mòbil o la tauleta i s'obre com una aplicació, amb la seva icona. No funciona sense connexió (no té *service worker*), tot i que el dibuix sempre queda desat al navegador.

---

## Compartir amb un enllaç

A **Desa a… → Enllaç per compartir → Crea l'enllaç** s'obté un enllaç que conté tot el dibuix. Qui l'obri el veurà al seu navegador i en tindrà una còpia per editar (els canvis no se sincronitzen entre persones).

**Com funciona.** No hi ha cap servidor: el dibuix es converteix a JSON, es comprimeix (`CompressionStream`, format *deflate*), es codifica en base64url i s'afegeix a l'adreça després de `#dibuix=`. El fragment de l'adreça (la part després de `#`) no s'envia mai al servidor web, de manera que el dibuix només viatja dins de l'enllaç.

**En obrir un enllaç:**
- Si el navegador no té cap dibuix, s'obre directament.
- Si ja n'hi ha un, es demana confirmació abans de substituir-lo. Es pot desfer amb `Ctrl+Z`.
- Un cop obert, el `#dibuix=…` s'esborra de la barra d'adreces i el dibuix queda desat al navegador com qualsevol altre.

**Coses a tenir en compte:**
- **L'enllaç apunta a l'adreça on tens la pissarra.** Si l'obres com a fitxer local (`file://…`), l'enllaç només funcionarà en aquest ordinador; el diàleg t'ho avisa. Per compartir-lo amb altres persones, publica la pissarra en un servidor web.
- **Llargada.** Un dibuix normal ocupa uns pocs centenars o milers de caràcters. Si l'enllaç passa de 8.000 caràcters, el diàleg avisa que algunes aplicacions de missatgeria el podrien tallar. El límit dur és d'uns 2 milions de caràcters.
- **Imatges.** Ocupen molt d'espai. Si el dibuix en té, es pot triar si s'inclouen («Inclou les imatges»; ve marcat si en total són petites). Si no s'hi inclouen, a l'altre navegador es veuran com a requadres buits.
- **Privadesa.** El dibuix no està xifrat: qualsevol persona que tingui l'enllaç el pot veure.
- Al mòbil hi ha també el botó **Comparteix…**, que obre el menú de compartir del sistema.

---

## Dreceres de teclat

| Acció | Drecera |
|---|---|
| Selecció | `V` o `1` |
| Mà (desplaçar) | `H` |
| Rectangle | `R` o `2` |
| Rombe | `D` o `3` |
| El·lipse | `O` o `4` |
| Fletxa | `A` o `5` |
| Línia | `L` o `6` |
| Llapis | `P` o `7` |
| Text | `T` o `8` (o doble clic al llenç) |
| Pòsit | `N` |
| Imatge | `9` |
| Goma | `E` o `0` |
| Pot de pintura | `B` (amb `Alt`+clic agafa un color) |
| Comptagotes | `I` |
| Mantenir l'eina activa | `Q` |
| Desfer / Refer | `Ctrl+Z` / `Ctrl+Maj+Z` o `Ctrl+Y` |
| Copiar / Retallar / Enganxar | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` |
| Duplicar | `Ctrl+D` o `Alt` + arrossegar |
| Seleccionar-ho tot | `Ctrl+A` |
| Eliminar | `Supr` o `Retrocés` |
| Moure la selecció | Fletxes (el pas es tria al menú, «Pas de les fletxes») / `Maj` + fletxes: 10 vegades el pas |
| Portar endavant / enrere | `Ctrl+]` / `Ctrl+[` (amb `Maj`: al davant / al fons) |
| Girar | Arrossegar la nansa rodona (amb `Maj`: passos de 15°) |
| Girar 90° a la dreta / a l'esquerra | `Maj+R` / `Alt+Maj+R` |
| Invertir horitzontalment / verticalment | `Maj+H` / `Maj+V` |
| Agrupar / Desagrupar | `Ctrl+G` / `Ctrl+Maj+G` |
| Editar dins d'un grup | Doble clic sobre el grup (`Esc` per sortir-ne) |
| Editar el text seleccionat | `Retorn` |
| Confirmar el text | `Esc` o `Ctrl+Retorn` |
| Proporcions fixes / angles de 15° | Mantenir `Maj` mentre es dibuixa |
| Zoom | `Ctrl` + roda, `Ctrl` + `+` / `−`, `Ctrl+0` (100 %) |
| Ajustar a la pantalla | `Maj+1` |
| Quadrícula | `G` |
| Tema clar / fosc | `Alt+Maj+D` |
| Obrir / Desa a… (fitxer o enllaç) | `Ctrl+O` / `Ctrl+S` |
| Exportar imatge | `Ctrl+Maj+E` |
| Copiar la selecció (o tot) com a PNG | `Alt+Maj+C` |
| Menú contextual | Clic dret · `Maj+F10` · tecla de menú |
| Afegir o editar un enllaç | `Ctrl+K` |
| Ajuda | `?` |

A macOS, `Ctrl` és `Cmd`.

### Pantalles tàctils
- **Un dit**: dibuixar o seleccionar, segons l'eina.
- **Dos dits**: zoom i desplaçament.
- **Doble toc**: escriure un text (o editar-ne un d'existent).
- **Toc llarg** (amb l'eina de selecció o la mà): obre el menú contextual de l'element tocat o del llenç.
- **Botó «Estil»** (mòbil): obre les opcions de color, gruix, etc.

### Línies i fletxes corbes
Selecciona una línia o fletxa: apareixen nanses als extrems i un punt al mig de cada tram. Arrossega el punt del mig per afegir-hi un vèrtex i corbar-la. Fes doble clic sobre un vèrtex per eliminar-lo.

### Fletxes i línies enganxades als elements
Les fletxes i les línies es poden **enganxar** a rectangles, rombes, el·lipses, textos i imatges, de manera que **segueixen l'element** quan el mous, el redimensiones o el gires. Així es poden fer diagrames encadenats (A → B → C → D…): cada element pot tenir tantes fletxes enganxades com calgui.

- **Enganxar:** comença o acaba la fletxa a sobre d'un element (o molt a prop de la vora). Mentre dibuixes, l'element on s'enganxarà es ressalta, i la punta es col·loca a la vora, amb una petita separació. Si la deixes a prop del centre de l'element, la fletxa hi apunta; si no, apunta cap al punt on l'has deixada.
- **Fletxes ja dibuixades:** selecciona-la i arrossega un extrem sobre un element per enganxar-l'hi, o fora de l'element per desenganxar-lo. Els extrems enganxats es veuen plens.
- **Sense enganxar:** mantén premut `Ctrl` (`Cmd` al Mac) mentre dibuixes o arrossegues l'extrem.
- **Moure la fletxa sola** (sense l'element on està enganxada) la desenganxa d'aquell element. Si selecciones i mous els elements i les fletxes alhora, es mantenen enganxades.
- **Duplicar o copiar i enganxar** un conjunt d'elements i fletxes manté les unions entre les còpies.
- **Esborrar un element** deixa les fletxes on són, desenganxades.
- Una fletxa amb punts intermedis només recol·loca els extrems; els punts del mig es queden on són.

---

## Estructura del projecte

```
pissarra/
├── index.html        Estructura de la pàgina, icones (SVG en línia) i diàlegs
├── favicon.ico       Icona per als navegadors antics (16, 32 i 48 px)
├── manifest.webmanifest  Nom, colors i icones per afegir-la a la pantalla d'inici
├── icon/
│   ├── favicon.svg           Icona principal (vectorial)
│   ├── favicon-32.png        Icona PNG de 32 px
│   ├── apple-touch-icon.png  Icona per a iOS (180 px)
│   ├── icon-192.png, icon-512.png  Icones de l'aplicació
│   ├── icon-maskable-512.png       Versió «maskable» per a Android
│   └── maskable.svg          Original de la versió «maskable»
├── css/
│   └── styles.css    Estils, temes clar i fosc, disseny adaptable
├── js/
│   ├── sketch.js     Generador de traços "a mà" (retorna camins SVG)
│   ├── renderer.js   Pintat al canvas, colors segons el tema, exportació PNG/SVG
│   └── app.js        Eines, selecció, historial, teclat, fitxers i interfície
└── README.md
```

Els scripts són clàssics (no mòduls ES) perquè la pàgina funcioni també obrint-la des de `file://`. Cada fitxer exposa un únic objecte global: `PissarraSketch`, `PissarraRender` i, per depurar des de la consola, `Pissarra`.

### Com funciona per dins
- Cada element es desa com un objecte senzill (`type`, `x`, `y`, `w`, `h`, `points`, colors, etc.).
- `sketch.js` converteix la geometria en camins SVG amb un petit soroll determinista (llavor per element). El mateix camí es pinta al canvas amb `Path2D` i s'escriu tal qual a l'exportació SVG, així el PNG i l'SVG coincideixen amb el que es veu a la pantalla.
- Els camins es guarden en memòria cau i només es recalculen quan l'element canvia de forma o d'estil (no quan es mou).
- L'historial guarda instantànies dels elements; les imatges es guarden a part per no inflar-lo.
- Les formes, els textos i les imatges tenen un camp `angle` (en radians) i giren al voltant del seu centre; les imatges també tenen `flipX` i `flipY`. Les línies, les fletxes i el llapis no guarden angle: quan es giren o s'inverteixen, es transformen directament els seus punts.
- Cada element té un camp `groupIds` amb els identificadors dels grups als quals pertany, del més intern al més extern (el mateix criteri que l'Excalidraw). Els grups que es queden amb menys de dos elements s'eliminen automàticament.
- Les fletxes i línies poden tenir `startBinding` i `endBinding`, de la forma `{ id, fx, fy }`: l'element on estan enganxades i un punt de focus relatiu a la seva caixa (de 0 a 1). Cada vegada que l'element canvia, l'extrem es recalcula com el punt on la recta que va del punt veí cap al focus talla la vora de l'element (rectangle, rombe o el·lipse, també girats), menys una separació de 5 px.

---

## Format dels fitxers

Els dibuixos es desen en JSON:

```json
{
  "type": "pissarra",
  "version": 1,
  "elements": [
    { "id": "…", "type": "rectangle", "x": 100, "y": 80, "w": 200, "h": 120,
      "stroke": "#1e1e1e", "fill": "#a5d8ff", "fillStyle": "hachure",
      "strokeWidth": 2, "strokeStyle": "solid", "roughness": 1,
      "opacity": 100, "roundness": "round", "seed": 12345, "version": 3 }
  ],
  "files": { "img_…": "data:image/png;base64,…" }
}
```

Tipus d'element: `rectangle`, `ellipse`, `diamond`, `line`, `arrow`, `freedraw`, `text`, `note` (pòsit) i `image`. Qualsevol element pot tenir `"shadow": 1` (ombra suau) o `2` (marcada) i `"link": "https://…"` (enllaç); si no en té, no porta el camp.

---

## Compatibilitat

Navegadors actuals: Chrome, Edge, Firefox i Safari (també a iOS i Android). Fa servir Pointer Events, `Path2D`, `<dialog>` i `localStorage`.

---

## Dependències opcionals

L'única cosa externa és la lletra **Caveat** de Google Fonts, per al text "a mà". Si no hi ha connexió, la pàgina continua funcionant amb una lletra cursiva del sistema. Si vols que sigui 100 % fora de línia:

1. Descarrega Caveat (té llicència SIL Open Font License) i desa-la, per exemple, a `fonts/Caveat.woff2`.
2. Treu les tres línies de Google Fonts de l'`<head>` d'`index.html`.
3. Afegeix al principi de `css/styles.css`:

```css
@font-face {
  font-family: "Caveat";
  src: url("../fonts/Caveat.woff2") format("woff2");
  font-weight: 400 700;
  font-display: swap;
}
```

---

## Limitacions conegudes

- En una selecció de diversos elements on n'hi ha algun de girat, el canvi de mida sempre manté les proporcions (si no, els elements girats es deformarien).
- Les fletxes enganxades fan el camí recte des del punt veí fins a l'element: no esquiven altres elements ni fan angles rectes automàtics (les «fletxes en colze» de l'Excalidraw).
- El text no s'ajusta automàticament dins d'una forma: el doble clic sobre una forma crea un text centrat, però és un element independent.
- No hi ha col·laboració en temps real: l'enllaç per compartir envia una còpia del dibuix, no una sessió compartida.
- La importació d'Excalidraw és bàsica: es conserven el gir, els grups, les imatges invertides i les fletxes enganxades (que apunten al centre de l'element), però s'ignoren els textos lligats a formes i els marcs.
- «Enganxa» des del menú contextual necessita permís per llegir el porta-retalls. Si el navegador no el dona (o a la vista prèvia dins de Claude), enganxa l'última cosa copiada o retallada a la mateixa pissarra; per enganxar contingut d'altres aplicacions, cal `Ctrl+V`.
- El desament automàtic depèn de l'espai del navegador (normalment uns 5 MB). Amb moltes imatges grans pot no caber-hi tot; en aquest cas, l'aplicació avisa i convé desar el dibuix a un fitxer.

---

## Personalització ràpida

- **Colors de la interfície**: variables CSS a l'inici de `css/styles.css` (`:root[data-theme="dark"]` i `:root[data-theme="light"]`).
- **Color del llenç i de la selecció**: objecte `THEMES` a `js/renderer.js`.
- **Paleta de colors**: botons `.swatch` dins el panell de propietats d'`index.html`.
- **Mides de text**: botons del grup `data-key="fontSize"` d'`index.html`.
- **Tema inicial**: valor `theme: 'dark'` a l'objecte `S` de `js/app.js`.
