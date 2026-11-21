# Proyecto Camisetas AR

Camisetas pintadas en **pixel art** con un código QR. La página abre la cámara, lee el QR y muestra al personaje de la camiseta en **vista isométrica** (estilo Habbo), paseando sobre una plataforma anclada al QR. No hace falta instalar ninguna app.

- **Prototipo en vivo:** https://xbrain081.github.io/Proyecto_camisetas/
- **Repositorio:** https://github.com/Xbrain081/Proyecto_camisetas

## Cómo funciona

Hay dos formas de entrar y las dos acaban igual:

```
A) Escáner dentro de la página                B) Cámara del móvil
   abrir la URL base                             escanear el QR con la cámara normal
   → "Abrir escáner de QR"                       → se abre …/?c=001
   → la página lee el QR en vivo                 → "Activar cámara y ver personaje"
              \                                  /
               └──────► la página sigue el QR en vivo ◄────┘
                        y ancla la plataforma encima de él
```

1. El QR contiene una URL como `https://xbrain081.github.io/Proyecto_camisetas/?c=001`. El parámetro `c` es el id del personaje.
2. La página lee el QR del vídeo (`js/qr-tracker.js`), carga `docs/characters/<id>.json` y muestra la escena isométrica (`js/iso.js`) centrada en el QR y con su tamaño.
3. Al mover el móvil, la plataforma sigue al QR (con suavizado).
4. **Si el QR sale de plano**, el personaje sigue anclado a su sitio en el mundo: la página mide cuánto se mueve la imagen de la cámara y mueve la plataforma igual (`createMotionEstimator` en `js/qr-tracker.js`). Al volver a enfocar el QR, la plataforma se recoloca sobre él. Hasta pulsar **Centrar** o **Salir** queda anclado; antes de leer el primer QR se puede arrastrar y pellizcar.
5. El personaje camina por la plataforma de baldosa en baldosa y gira: de frente al ir hacia abajo, de espaldas al ir hacia arriba, y la vista se espeja a izquierda/derecha.
6. La plataforma es **translúcida** (`FLOOR_ALPHA` en `js/iso.js`) para que parezca virtual y deje ver el QR de debajo.

### Alcance actual

- El anclaje usa **posición y tamaño** del QR. **No** sigue la rotación ni la perspectiva: la vista isométrica siempre se ve derecha, como en Habbo.
- La plataforma tapa visualmente al QR, pero la cámara lo sigue viendo, así que el seguimiento continúa.
- Fuera de plano el movimiento se **estima** a partir de la imagen: sirve para giros y desplazamientos de cámara moderados, pero acumula error (deriva) y falla si la escena no tiene textura (pared lisa) o hay mucho movimiento. Al ver el QR otra vez se corrige solo.
- Detección: `BarcodeDetector` nativo si el navegador lo trae (Chrome en Android) y, si no, la librería **jsQR** (Safari en iPhone y otros).

## Estructura

```
docs/                    ← lo que publica GitHub Pages (frontend)
  index.html
  css/styles.css
  js/app.js              ← cámara, anclaje, gestos, foto
  js/iso.js              ← plataforma isométrica y personaje que pasea
  js/qr-tracker.js       ← lectura del QR y estimación del movimiento de la cámara
  js/sprite.js           ← convierte el JSON del personaje en sprites
  js/vendor/jsQR.js      ← lector de QR (Apache-2.0, ver jsQR.LICENSE)
  characters/
    index.json           ← lista pública de personajes
    001.json             ← un archivo por personaje
server/                  ← backend y herramientas (Node + TypeScript)
  admin/                 ← panel local para subir personajes (no se publica)
  src/characters.ts      ← lectura y validación de personajes
  src/store.ts           ← guarda un personaje y actualiza el índice
  src/publish.ts         ← git add + commit + push de docs/characters
  src/qr-image.ts        ← URL y PNG del QR de cada personaje
  src/server.ts          ← servidor local + API + panel
  src/validate.ts        ← comprueba que todos los personajes son válidos
  src/qr.ts              ← genera todos los QR en server/qr-out/
```

GitHub Pages solo sirve archivos estáticos: **el prototipo publicado no necesita el backend**. El servidor Node sirve para desarrollar en local, subir personajes con el panel, validar el arte y generar los QR.

## Requisitos técnicos

| Para… | Necesitas |
|---|---|
| Usar la página (usuario final) | Móvil con navegador moderno (Chrome, Safari, Firefox, Edge), **HTTPS** (Pages lo da) y permiso de cámara |
| Desarrollar | [Node.js](https://nodejs.org) 20 o superior, Git |
| Publicar | Cuenta de GitHub con Pages activado (rama `main`, carpeta `/docs`) |

Sin permiso de cámara, abriendo `?c=001` la página muestra el personaje sobre un fondo neutro (sin anclaje). Sin cámara no se puede usar el escáner.

## Uso

### Probar en local

```powershell
cd server
npm install
npm run dev
```

Abre http://localhost:3000. La cámara funciona en `localhost`; para probar desde el móvil usa la versión publicada en Pages (necesita HTTPS). El servidor solo atiende a tu ordenador (`127.0.0.1`).

### Probar el flujo completo

1. Muestra `server/qr-out/qr-001.png` en una pantalla (o imprímelo).
2. En el móvil abre https://xbrain081.github.io/Proyecto_camisetas/, pulsa **Abrir escáner de QR** y enfoca el QR. Deberías ver a Bit paseando sobre él.
3. Mueve el móvil: la plataforma debe seguir al QR.
4. Alternativa: escanea el QR con la cámara normal del móvil; se abrirá la página y, tras activar la cámara, enfoca el QR para anclarlo.

### Subir un personaje nuevo (panel)

Con el servidor en marcha (`npm run dev` dentro de `server/`), abre **http://localhost:3000/admin/**:

1. **Sube tu arte** en PNG con fondo transparente. Un PNG por vista, con los fotogramas en una **tira horizontal** y cada uno cuadrado (el ancho es múltiplo del alto; 16×16 recomendado, máximo 64×64):
   - *De frente*: 2 fotogramas (los dos pasos al caminar).
   - *De espaldas*: opcional, otros 2.
   - Máximo 62 colores. El panel convierte el PNG a texto automáticamente y muestra una vista previa animada.
2. Escribe un **identificador** (por ejemplo `002`) y un **nombre**, y pulsa **Guardar personaje**. Se guarda en `docs/characters/` y se actualiza el índice. Aparece su **QR para descargar**.
3. Pulsa **Publicar en GitHub Pages**: sube los cambios a GitHub (equivale a `git add`, `commit` y `push` de `docs/characters`). En 1–2 minutos, al escanear el QR se ve el personaje.

Si guardas con un identificador que ya existe, te pide confirmación y lo reemplaza: todas las camisetas con ese QR mostrarán el arte nuevo.

Seguridad: el panel solo responde a páginas servidas por el propio servidor local, y solo puede publicar cambios dentro de `docs/characters`. Necesita Git instalado y con sesión iniciada en GitHub (el `push` usa tus credenciales).

### Añadir un personaje a mano

Alternativa al panel:

1. Copia `docs/characters/001.json` a `docs/characters/002.json`.
2. Cambia `id`, `name`, la `palette` y los fotogramas:
   - `frames`: el personaje **de frente**, con 2 fotogramas de caminar (se alternan los pies).
   - `back`: el personaje **de espaldas** (opcional; si falta se usa `frames`).
   - Cada fotograma es una lista de filas de texto del mismo ancho y alto (16×16 en el ejemplo).
   - `.` es transparente; cualquier otra letra debe existir en `palette` (`"K": "#1b1b2f"`).
   - `fps` es la velocidad del paso al caminar.
   - Solo dibujas dos vistas: la escena espeja cada una para cubrir las cuatro direcciones. Si el diseño es asimétrico (un detalle a un lado), se notará el giro.
3. Añádelo a `docs/characters/index.json`.
4. Comprueba que es válido:
   ```powershell
   cd server
   npm run validate
   ```
5. Genera su QR: `npm run qr` (los PNG salen en `server/qr-out/`).
6. `git add . && git commit -m "Añade personaje 002" && git push`. Pages se actualiza en 1–2 minutos.

### Imprimir el QR en la camiseta

- Tamaño mínimo **4–5 cm**, con margen blanco alrededor y máximo contraste (negro sobre blanco). Como la cámara lo sigue en vivo, cuanto más grande y nítido, mejor.
- Sobre una zona **plana**, sin pliegues ni costuras.
- Mejor serigrafía o vinilo que pintura a mano; **prueba que sigue leyéndose tras varios lavados**.
- Los QR se generan con corrección de errores "M": menos cuadraditos y más grandes, que se leen desde más lejos. Si necesitas más resistencia al desgaste, cambia a `'Q'` o `'H'` en `server/src/qr.ts` y haz el QR más grande.
- Si el dominio cambia: `BASE_URL=https://tu-dominio.com/ npm run qr`.

## Mantenimiento

**Los QR son permanentes; la URL no puede cambiar sin reimprimir.** Por eso:

- **No renombres el repositorio** ni la cuenta: cambiaría la URL de Pages. Si quieres mayor libertad, compra un dominio propio y configúralo en *Settings → Pages → Custom domain* **antes** de imprimir muchas camisetas.
- **No cambies nunca un `id` ya impreso.** Puedes modificar el arte de `001.json` cuando quieras: todas las camisetas ya vendidas mostrarán la versión nueva.
- Ejecuta `npm run validate` antes de cada `push`.
- Actualiza dependencias del servidor de vez en cuando: `cd server && npm outdated && npm update`, y comprueba que `npm run typecheck` pasa.
- `docs/js/vendor/jsQR.js` es la versión 1.4.0 de [jsQR](https://github.com/cozmo/jsQR), copiada tal cual. Si la actualizas, sustituye el archivo y vuelve a probar el escáner en iPhone.
- Revisa cada pocos meses que la página abre y la cámara funciona en iPhone y Android: los navegadores cambian sus reglas de permisos.
- Mantén una copia del arte original (PNG o fichero de tu editor de pixel art) fuera del repositorio.

## Limitaciones conocidas

- El anclaje, el seguimiento fuera de plano y el panel se probaron en un navegador de escritorio con una cámara simulada y el lector jsQR. **Falta probar el seguimiento fuera de plano con cámara real en móvil**, y con el QR impreso en tela.
- El seguimiento ignora la rotación y la perspectiva del QR (ver Alcance actual).
- Con poca luz, reflejos o el QR muy lejano o arrugado, la lectura puede fallar o entrecortarse.
- El anclaje a superficies reales (WebXR) **no funciona en Safari de iOS**; en iPhone requeriría AR Quick Look con archivos `.usdz`.

## Cómo se ha probado

- **Cámara simulada** en el navegador de escritorio: se sustituye `getUserMedia` por un `canvas.captureStream()` que dibuja un QR sobre un fondo con textura (bloques de colores al azar). La textura es necesaria para probar el seguimiento fuera de plano, que mide el movimiento de la imagen; esos bloques son solo del montaje de prueba y **no forman parte de la web**.
- Comprobado así: lectura del QR con jsQR, anclaje, QR fuera de plano y reenfoque, plataforma translúcida, y el panel de personajes (guardar, QR, publicar sin cambios).
- Pendiente: pruebas con cámara real en iPhone y Android, y con el QR impreso en tela.

## Hoja de ruta

1. Probar con cámara real en iPhone y Android y ajustar tamaños, suavizado y tiempos.
2. Pasar a las camisetas: imprimir el QR en tela y ajustar el tamaño del QR, la plataforma y el contraste.
3. Más animaciones (saludar, sentarse) y las 8 direcciones de Habbo.
4. Seguimiento con rotación y perspectiva (homografía con las 4 esquinas del QR), y movimiento fuera de plano más preciso con el giroscopio del móvil.
5. Opcional: contador de escaneos o personajes desbloqueables (requiere backend con base de datos).
