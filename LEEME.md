# Fútbol Tenis

Fútbol tenis 3D que se juega en el navegador: amistoso contra la compu, la Copa LD de 16 jugadores, u online con un amigo usando un código de partido.

## Qué hay en la carpeta

- `public/index.html`: el juego completo.
- `public/three.min.js`: la librería 3D. Va incluida, así que no depende de ningún otro sitio.
- `server.js`: un servidor chico que muestra la página, conecta a los jugadores online y guarda la lista de campeones.
- `package.json`: le dice al hosting cómo arrancar el servidor (`npm start`).

## Probarlo en tu compu

Necesitás tener Node.js 18 o más nuevo instalado.

```
npm install
npm start
```

Después abrí http://localhost:3000. Para probar el modo online, abrí dos pestañas: en una tocá **Crear partido** y en la otra poné el código.

## Subirlo a internet con Render (gratis)

1. Subí esta carpeta a un repositorio de GitHub (sin la carpeta `node_modules`).
2. En render.com, tocá **New → Web Service** y elegí el repositorio.
3. Completá **Build Command** con `npm install`, **Start Command** con `npm start` e **Instance Type** en **Free**.
4. Tocá **Deploy**. Render te da una dirección del tipo `futbol-tenis.onrender.com`: ese es el juego.

En el plan gratis, si nadie entra por unos 15 minutos el servidor se apaga, y el primero que entra después espera alrededor de un minuto.

También funciona en Railway (pago) o en cualquier otro hosting de Node que acepte WebSockets.

## Lista de campeones

Cuando alguien gana la Copa LD puede guardar su nombre en la lista de campeones, con la dificultad, el resultado de la final y la fecha. En la web esa lista la guarda el servidor, así que la ven todos los que entran.

El servidor la guarda en el archivo `data/campeones.json`. En los planes gratis ese archivo se borra cada vez que el servidor se reinicia o subís una versión nueva. Para que la lista no se pierda nunca, agregale al servicio un disco persistente (en Render: **Disks**, es pago), montalo en una carpeta, por ejemplo `/var/data`, y creá la variable de entorno `DATA_DIR` con esa misma ruta.

Si el servidor no responde, cada compu guarda la lista por su cuenta.

## Cómo funciona el online

- El que crea el partido juega con Celeste y su navegador lleva la pelota y las reglas.
- El que se une juega con Naranja. Mueve a su jugador sin demora, pero sus golpes pasan por el servidor, así que puede notar un pequeño retraso al pegarle.
- Cada uno ve el nombre que puso en el menú.
- Si entra un tercero con el mismo código, mira el partido sin jugar.
- El que creó el partido tiene que dejar la pestaña del juego a la vista. Si la minimiza, el partido se congela para los dos.

## Gráficos

En el menú se elige **Livianos** (viene así de fábrica) o **Lindos**:

- **Livianos** saca las sombras reales, el suavizado de bordes y las luces extra, y usa materiales más simples. Si igual la compu no llega a unos 35 cuadros por segundo, el juego baja la resolución de a poco por su cuenta.
- **Lindos** es la versión con sombras y luces, para compus con buena placa de video.
