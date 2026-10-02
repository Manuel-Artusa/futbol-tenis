# Fútbol Tenis

Fútbol tenis 3D que se juega en el navegador, contra la compu u online con un amigo usando un código de partido.

## Qué hay en la carpeta

- `public/index.html`: el juego completo.
- `public/three.min.js`: la librería 3D. Va incluida, así que no depende de ningún otro sitio.
- `server.js`: un servidor chico que muestra la página y conecta a los jugadores online.
- `package.json`: le dice al hosting cómo arrancar el servidor (`npm start`).

## Probarlo en tu compu

Necesitás tener Node.js 18 o más nuevo instalado.

```
npm install
npm start
```

Después abrí http://localhost:3000. Para probar el modo online, abrí dos pestañas: en una tocá **Crear partido** y en la otra poné el código.

## Subirlo a internet con Railway

1. Subí esta carpeta a un repositorio nuevo de GitHub (sin la carpeta `node_modules`).
2. En Railway, creá un proyecto con **New Project → Deploy from GitHub repo** y elegí ese repositorio. Railway detecta solo que es Node y lo arranca con `npm start`.
3. En el servicio, entrá a **Settings → Networking → Generate Domain**. Railway te da una dirección del tipo `algo.up.railway.app`.
4. Esa dirección es el juego: pasásela a quien quieras. No hace falta cuenta para jugar.

Para que el online tenga menos demora, elegí en **Settings → Region** la región más cerca de los jugadores. Railway no tiene servidores en Sudamérica, así que para Argentina conviene la de Estados Unidos (este).

También funciona en Render o en cualquier otro hosting de Node que acepte WebSockets.

## Cómo funciona el online

- El que crea el partido juega con Celeste y su navegador lleva la pelota y las reglas.
- El que se une juega con Naranja. Mueve a su jugador sin demora, pero sus golpes pasan por el servidor, así que puede notar un pequeño retraso al pegarle.
- Si entra un tercero con el mismo código, mira el partido sin jugar.
- El que creó el partido tiene que dejar la pestaña del juego a la vista. Si la minimiza, el partido se congela para los dos.

## Gráficos

En el menú se elige **Livianos** (viene así de fábrica) o **Lindos**:

- **Livianos** saca las sombras reales, el suavizado de bordes y las luces extra, y usa materiales más simples. Si igual la compu no llega a unos 35 cuadros por segundo, el juego baja la resolución de a poco por su cuenta.
- **Lindos** es la versión con sombras y luces, para compus con buena placa de video.
