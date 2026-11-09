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
- Imatges: des del botó, arrossegant un fitxer o enganxant-les del porta-retalls.
- Goma d'esborrar.
- Traç "a mà" generat pel propi programa, amb tres nivells: net, natural i desmanegat. Cada element té una llavor aleatòria, de manera que el dibuix no tremola quan es mou.

**Estil**
- Color del traç i del fons (paleta i color personalitzat).
- Emplenat ratllat, quadriculat o sòlid.
- Gruix, traç continu / discontinu / puntejat i opacitat.

**Edició**
- Selecció individual, múltiple (Maj + clic) o per àrea.
- Moure, canviar la mida (amb Maj per mantenir les proporcions) i editar els punts de línies i fletxes.
- Desfer i refer, copiar, retallar, enganxar i duplicar (també Alt + arrossegar).
- Ordre de capes i alineació de diversos elements.
- Quadrícula amb ajust automàtic.

**Vista**
- Llenç infinit amb desplaçament i zoom (roda, trackpad, Espai + arrossegar, pessic amb dos dits).
- Ajust del zoom al contingut.

**Fitxers**
- **Desament automàtic** al navegador (`localStorage`).
- Desar i obrir dibuixos en format JSON propi.
- **Importació bàsica de fitxers `.excalidraw`** (vegeu les limitacions).
- Exportació a **PNG** (escala 1×, 2× o 3×) i **SVG**, amb o sense fons, en tema clar o fosc, i de tot el dibuix o només de la selecció.
- Còpia de la imatge al porta-retalls (si el navegador ho permet).

**Interfície**
- **Tema fosc per defecte** i tema clar. El dibuix s'adapta al tema: els colors es desen en la versió clara i en tema fosc se n'inverteix la lluminositat mantenint el to.
- Adaptada a **PC, tauleta i mòbil**: al mòbil la barra d'eines baixa a la part inferior (a l'abast del polze) i les opcions d'estil s'obren en un panell amb el botó «Estil».
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
Com que són fitxers estàtics, es pot publicar tal qual a GitHub Pages, Netlify, Cloudflare Pages o qualsevol servidor web.

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
| Imatge | `9` |
| Goma | `E` o `0` |
| Mantenir l'eina activa | `Q` |
| Desfer / Refer | `Ctrl+Z` / `Ctrl+Maj+Z` o `Ctrl+Y` |
| Copiar / Retallar / Enganxar | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` |
| Duplicar | `Ctrl+D` o `Alt` + arrossegar |
| Seleccionar-ho tot | `Ctrl+A` |
| Eliminar | `Supr` o `Retrocés` |
| Moure 1 px / 10 px | Fletxes / `Maj` + fletxes |
| Portar endavant / enrere | `Ctrl+]` / `Ctrl+[` (amb `Maj`: al davant / al fons) |
| Editar el text seleccionat | `Retorn` |
| Confirmar el text | `Esc` o `Ctrl+Retorn` |
| Proporcions fixes / angles de 15° | Mantenir `Maj` mentre es dibuixa |
| Zoom | `Ctrl` + roda, `Ctrl` + `+` / `−`, `Ctrl+0` (100 %) |
| Ajustar a la pantalla | `Maj+1` |
| Quadrícula | `G` |
| Tema clar / fosc | `Alt+Maj+D` |
| Obrir / Desar | `Ctrl+O` / `Ctrl+S` |
| Exportar imatge | `Ctrl+Maj+E` |
| Ajuda | `?` |

A macOS, `Ctrl` és `Cmd`.

### Pantalles tàctils
- **Un dit**: dibuixar o seleccionar, segons l'eina.
- **Dos dits**: zoom i desplaçament.
- **Doble toc**: escriure un text (o editar-ne un d'existent).
- **Botó «Estil»** (mòbil): obre les opcions de color, gruix, etc.

### Línies i fletxes corbes
Selecciona una línia o fletxa: apareixen nanses als extrems i un punt al mig de cada tram. Arrossega el punt del mig per afegir-hi un vèrtex i corbar-la. Fes doble clic sobre un vèrtex per eliminar-lo.

---

## Estructura del projecte

```
pissarra/
├── index.html        Estructura de la pàgina, icones (SVG en línia) i diàlegs
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

Tipus d'element: `rectangle`, `ellipse`, `diamond`, `line`, `arrow`, `freedraw`, `text` i `image`.

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

- No es poden girar elements ni agrupar-los.
- Les fletxes no s'enganxen a les formes (si mous una forma, la fletxa no la segueix).
- El text no s'ajusta automàticament dins d'una forma: el doble clic sobre una forma crea un text centrat, però és un element independent.
- No hi ha col·laboració en temps real.
- La importació d'Excalidraw és bàsica: s'ignoren la rotació, els grups, els vincles entre fletxes i formes i els marcs.
- El desament automàtic depèn de l'espai del navegador (normalment uns 5 MB). Amb moltes imatges grans pot no caber-hi tot; en aquest cas, l'aplicació avisa i convé desar el dibuix a un fitxer.

---

## Personalització ràpida

- **Colors de la interfície**: variables CSS a l'inici de `css/styles.css` (`:root[data-theme="dark"]` i `:root[data-theme="light"]`).
- **Color del llenç i de la selecció**: objecte `THEMES` a `js/renderer.js`.
- **Paleta de colors**: botons `.swatch` dins el panell de propietats d'`index.html`.
- **Mides de text**: botons del grup `data-key="fontSize"` d'`index.html`.
- **Tema inicial**: valor `theme: 'dark'` a l'objecte `S` de `js/app.js`.
