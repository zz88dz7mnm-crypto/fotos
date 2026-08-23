# OCASO

Un instrumento de atención, no una app de meditación más.

En vez de decirte "es hora de meditar", OCASO te muestra que el sol se pone en
40 minutos, hoy, donde estás — y te invita a parar con eso, no con una
notificación genérica.

Todo vive en `index.html`. Sin build, sin dependencias, sin backend.

---

## Cómo funciona

### El cielo se calcula, no se consulta

La posición del sol y de la luna se computan en el navegador con las series
periódicas de **Meeus** (*Astronomical Algorithms*), no con una API:

- **Sol** — anomalía media, ecuación del centro y oblicuidad para obtener
  declinación y ascensión recta; amanecer, atardecer, hora dorada y
  crepúsculo civil por búsqueda de cruces de altura sobre el día local.
- **Luna** — los 60 términos principales de las tablas 47.A y 47.B para
  longitud, latitud y distancia; fase, fracción iluminada y ángulo del limbo
  brillante por el capítulo 48; salida y puesta con
  `h₀ = 0.7275·π − 0.5666°`, que corrige paralaje, semidiámetro y refracción.

Contrastado contra los datos de un widget de clima de iOS para Córdoba el
23/8/2026: **83,8 % vs 84 %** de luminosidad, **403 192 km vs 403 190 km** de
distancia, salida y puesta dentro de los 3 minutos.

La consecuencia de producto: la app funciona entera sin conexión. Si se cae la
red, lo único que se pierde es el widget de clima, y lo dice.

### La luna es una esfera de verdad

No es una imagen ni una máscara sobre un círculo. En el arranque se generan dos
mapas equirectangulares de 1024×512 px:

- **albedo** — tierras altas con ruido fBm, mares de lava dibujados como
  lóbulos superpuestos de costa irregular en sus posiciones selenográficas
  reales (Imbrium, Serenitatis, Crisium, Procellarum…) y sistemas de rayos
  aerografiados sobre Tycho, Copérnico, Kepler y Aristarco;
- **altura** — unos 900 cráteres con distribución de ley de potencias, borde
  elevado, piso hundido, pico central y manto de eyección; menos cráteres sobre
  los mares, que son más jóvenes.

De ahí se derivan las pendientes este/norte y cada píxel del disco se sombrea
con su normal perturbada, mezclando Lambert con **Lommel-Seeliger** — el modelo
que explica por qué la luna llena se ve plana y no como una bola con caída de
brillo hacia el borde. El terminador cae donde lo pone el ángulo de fase real,
y el relieve se recorta contra él. En el hemisferio sur la creciente se ilumina
por la izquierda.

### El sol es una esfera de plasma

Fotosfera con oscurecimiento de limbo (`I = 1 − u(1 − cos θ)`), granulación de
dos capas de ruido girando en sentidos opuestos, manchas, cromosfera y corona.
Bajo el horizonte no se apaga: se vuelve brasa.

### El fondo es un dato convertido en luz

El gradiente de la página se interpola en luz lineal sobre una rampa indexada
por la **altura real del sol**, de dorado a marrón profundo a negro noche. El
resplandor se mueve por la pantalla siguiendo el azimut y la altura reales; de
noche aparecen las estrellas y el halo frío de la luna. Es, literalmente, un
reloj de luz.

### El botón "Ahora"

Cruza hora, cielo y luna para armar la práctica del momento — última luz, hora
azul, primera luz, sonido de lluvia, cielo cerrado, luz de luna, oscuridad,
sombra o viento — con su duración y su sonido ya elegidos. Cero menú, cero
elección paralizante.

---

## La estética, aplicada de verdad

Del manifiesto *Una sola estética* (interfaz de clima + Kodak FunSaver + moai
surfista + camaleones aerografiados + kasbah de adobe). No es piel decorativa:
cada capa es una decisión funcional.

| Pilar | Dónde vive en la app |
|---|---|
| Base terrosa continua | La rampa del fondo nunca deja de ser cálida, ni de noche |
| Oscuridad como lienzo | Los paneles son vidrio oscuro a cualquier hora: el brillo emerge de la sombra |
| Turquesa como respiro | Sólo de noche, y sólo en el widget de luna |
| Rugosidad de adobe | Grano de aerógrafo y mancha de barro sobre toda la superficie |
| Trama textil | Retícula tejida sobre cada panel de vidrio |
| Vidrio esmerilado | `backdrop-filter` con resplandor ámbar entrando por el ángulo superior |
| Plástico brillante | El botón "Ahora" y el círculo de respiración: contorno de tinta, sombra dura desplazada, brillo satinado |
| Cuadrícula ordenada / contenido orgánico | Bento rígido por fuera, esferas y manchas por dentro |

Tipografías: **Fredoka** para la marca (wordmark redondeada y cálida) y
**Outfit** para datos y versalitas.

---

## Lo que todavía no es real

- **Los sonidos son sintetizados**, no grabados. Viento, agua, fuego y tela se
  arman con WebAudio (ruido marrón filtrado con ráfagas, gotas resonantes,
  chisporroteo, roce granular). La propuesta pide grabaciones de campo; entran
  cuando haya con qué grabarlas, sin tocar el resto.
- **El clima necesita red.** Llega de [Open-Meteo](https://open-meteo.com)
  (nubosidad, viento, UV, lluvia, temperatura). Sin conexión el widget lo dice
  y el resto sigue andando.

---

## Privacidad

No hay cuentas, ni analítica, ni backend. La ubicación y las preferencias se
guardan en `localStorage` del navegador. Lo único que sale del dispositivo es
la consulta de clima a Open-Meteo con las coordenadas redondeadas.

## Desarrollo

Es un archivo estático. Se abre con doble clic o se sirve con cualquier cosa:

```sh
npx http-server .
```
