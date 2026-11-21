# Proyecto Camisetas AR

Camisetas pintadas en **pixel art** con un código QR. Quien escanea el QR abre una página web y ve al personaje de la camiseta en **realidad aumentada**, sin instalar ninguna app.

- **Prototipo en vivo:** https://xbrain081.github.io/Proyecto_camisetas/ (prueba con `?c=001`)
- **Repositorio:** https://github.com/Xbrain081/Proyecto_camisetas

## Cómo funciona

```
Camiseta (QR) ──► https://xbrain081.github.io/Proyecto_camisetas/?c=001
                         │
                         ▼
        Página estática (HTML + CSS + JS)
        1. lee docs/characters/001.json  (sprite en texto + paleta)
        2. pide permiso de cámara
        3. dibuja el sprite animado sobre el vídeo (canvas, sin suavizado)
```

> **Alcance del prototipo:** el personaje se superpone a la cámara y el usuario lo mueve (arrastrar) y lo escala (pellizcar). **No** hay anclaje a superficies ni seguimiento de la camiseta todavía. Ver [Hoja de ruta](#hoja-de-ruta).

## Estructura

```
docs/                    ← lo que publica GitHub Pages (frontend)
  index.html
  css/styles.css
  js/app.js              ← cámara, gestos, render, foto
  js/sprite.js           ← convierte el JSON del personaje en canvas
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
| Usar la página (usuario final) | Móvil con navegador moderno (Chrome, Safari, Firefox, Edge) y **HTTPS** (Pages lo da). Permiso de cámara |
| Desarrollar | [Node.js](https://nodejs.org) 20 o superior, Git |
| Publicar | Cuenta de GitHub con Pages activado (rama `main`, carpeta `/docs`) |

Sin permiso de cámara la página sigue funcionando: muestra el personaje sobre un fondo neutro.

## Uso

### Probar en local

```powershell
cd server
npm install
npm run dev
```

Abre http://localhost:3000/?c=001. La cámara funciona en `localhost`; para probar desde el móvil necesitas HTTPS (lo más sencillo es probar la versión publicada en Pages).

### Añadir un personaje nuevo

1. Copia `docs/characters/001.json` a `docs/characters/002.json`.
2. Cambia `id`, `name`, la `palette` y los `frames`.
   - Cada fotograma es una lista de filas de texto; todas con el mismo ancho y alto.
   - `.` es transparente; cualquier otra letra debe existir en `palette` (`"K": "#1b1b2f"`).
   - Con 2 fotogramas ya hay animación; `fps` fija la velocidad.
3. Añádelo a `docs/characters/index.json`.
4. Comprueba que es válido:
   ```powershell
   cd server
   npm run validate
   ```
5. Genera su QR: `npm run qr` (los PNG salen en `server/qr-out/`).
6. `git add . && git commit -m "Añade personaje 002" && git push`. Pages se actualiza en 1–2 minutos.

### Imprimir el QR en la camiseta

- Tamaño mínimo **3–4 cm**, con margen blanco alrededor y máximo contraste (negro sobre blanco).
- Sobre una zona **plana**, sin pliegues ni costuras.
- Mejor serigrafía o vinilo que pintura a mano; **prueba que sigue leyéndose tras varios lavados**.
- El QR usa corrección de errores alta, así que tolera algo de desgaste.
- Si el dominio cambia: `BASE_URL=https://tu-dominio.com/ npm run qr`.

## Mantenimiento

**Los QR son permanentes; la URL no puede cambiar sin reimprimir.** Por eso:

- **No renombres el repositorio** ni la cuenta: cambiaría la URL de Pages. Si quieres mayor libertad, compra un dominio propio y configúralo en *Settings → Pages → Custom domain* **antes** de imprimir muchas camisetas.
- **No cambies nunca un `id` ya impreso.** Puedes modificar el arte de `001.json` cuando quieras: todas las camisetas ya vendidas mostrarán la versión nueva.
- Ejecuta `npm run validate` antes de cada `push`.
- Actualiza dependencias de vez en cuando: `cd server && npm outdated && npm update`, y comprueba que `npm run typecheck` pasa.
- Revisa cada pocos meses que la página abre y la cámara funciona en iPhone y Android: los navegadores cambian sus reglas de permisos.
- Mantén una copia del arte original (PNG o fichero de tu editor de pixel art) fuera del repositorio.

## Limitaciones conocidas

- El anclaje a superficies reales (WebXR) **no funciona en Safari de iOS**; en iPhone requiere AR Quick Look con archivos `.usdz`.
- Esta versión no ha sido probada con cámara real en todos los dispositivos. Verifícala en tu móvil antes de imprimir.

## Hoja de ruta

1. Probar con cámara real en iPhone y Android y ajustar.
2. Más personajes y animaciones (andar, saludar).
3. AR con superficie: exportar a GLB/USDZ (voxels) y usar `model-viewer`.
4. Opcional: seguimiento de imagen sobre la propia camiseta (MindAR); es el más frágil por las arrugas de la tela.
5. Opcional: contador de escaneos o personajes desbloqueables (requiere backend con base de datos).
