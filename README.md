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
3. Al mover el móvil, la plataforma sigue al QR (con suavizado). Si se pierde de vista más de ~1 s, el personaje queda donde estaba y se puede arrastrar/pellizcar hasta que se vuelva a ver el QR.
4. El personaje camina por la plataforma de baldosa en baldosa y gira: de frente al ir hacia abajo, de espaldas al ir hacia arriba, y la vista se espeja a izquierda/derecha.

### Alcance actual

- El anclaje usa **posición y tamaño** del QR. **No** sigue la rotación ni la perspectiva: la vista isométrica siempre se ve derecha, como en Habbo.
- La plataforma tapa visualmente al QR, pero la cámara lo sigue viendo, así que el seguimiento continúa.
- Detección: `BarcodeDetector` nativo si el navegador lo trae (Chrome en Android) y, si no, la librería **jsQR** (Safari en iPhone y otros).

## Estructura

```
docs/                    ← lo que publica GitHub Pages (frontend)
  index.html
  css/styles.css
  js/app.js              ← cámara, anclaje, gestos, foto
  js/iso.js              ← plataforma isométrica y personaje que pasea
  js/qr-tracker.js       ← lectura del QR en el vídeo
  js/sprite.js           ← convierte el JSON del personaje en sprites
  js/vendor/jsQR.js      ← lector de QR (Apache-2.0, ver jsQR.LICENSE)
  characters/
    index.json           ← lista pública de personajes
    001.json             ← un archivo por personaje
server/                  ← backend y herramientas (Node + TypeScript)
  src/characters.ts      ← lectura y validación de personajes
  src/server.ts          ← servidor local + API
  src/validate.ts        ← comprueba que todos los personajes son válidos
  src/qr.ts              ← genera un QR (PNG) por personaje
```

GitHub Pages solo sirve archivos estáticos: **el prototipo publicado no necesita el backend**. El servidor Node sirve para desarrollar en local, validar el arte y generar los QR.

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

Abre http://localhost:3000. La cámara funciona en `localhost`; para probar desde el móvil usa la versión publicada en Pages (necesita HTTPS).

### Probar el flujo completo

1. Muestra `server/qr-out/qr-001.png` en una pantalla (o imprímelo).
2. En el móvil abre https://xbrain081.github.io/Proyecto_camisetas/, pulsa **Abrir escáner de QR** y enfoca el QR. Deberías ver a Bit paseando sobre él.
3. Mueve el móvil: la plataforma debe seguir al QR.
4. Alternativa: escanea el QR con la cámara normal del móvil; se abrirá la página y, tras activar la cámara, enfoca el QR para anclarlo.

### Añadir un personaje nuevo

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

- Probado en un navegador de escritorio con una cámara simulada y el lector jsQR. **Falta probarlo con cámara real en móvil**, y con el QR impreso en tela.
- El seguimiento ignora la rotación y la perspectiva del QR (ver Alcance actual).
- Con poca luz, reflejos o el QR muy lejano o arrugado, la lectura puede fallar o entrecortarse.
- El anclaje a superficies reales (WebXR) **no funciona en Safari de iOS**; en iPhone requeriría AR Quick Look con archivos `.usdz`.

## Hoja de ruta

1. Probar con cámara real en iPhone y Android y ajustar tamaños, suavizado y tiempos.
2. Pasar a las camisetas: imprimir el QR en tela y ajustar el tamaño del QR, la plataforma y el contraste.
3. Más animaciones (saludar, sentarse) y las 8 direcciones de Habbo.
4. Seguimiento con rotación y perspectiva (homografía con las 4 esquinas del QR).
5. Opcional: contador de escaneos o personajes desbloqueables (requiere backend con base de datos).
