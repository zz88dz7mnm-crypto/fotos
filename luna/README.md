# 🌙 Luna Real

Visor lunar 3D: una esfera con la textura real de la Luna, iluminada por el Sol
real. Para el instante y el lugar que elijas se calcula la posición del Sol y de
la Luna, la libración y el ángulo del eje lunar, y con eso se orienta la textura
y se ilumina la esfera. El terminador —la línea entre luz y sombra— cae donde
corresponde y los cráteres proyectan sombra de verdad; no hay ninguna animación
de fases pregrabada.

## Cómo se abre

Doble clic en `index.html`. No necesita servidor, ni instalación, ni conexión:
las texturas van embebidas en el propio archivo JS y las bibliotecas están en
`vendor/`. Funciona igual servido por HTTP (en el sitio queda en `/luna/`).

## Qué hace

- **Línea de tiempo** de 33 días con la fase de cada día dibujada de verdad
  (mares reales, terminador con la inclinación real) y el porcentaje iluminado.
  El deslizador se mueve de a 5 minutos, así que se puede ver el terminador
  avanzar hora por hora. El botón ▶ anima el paso del tiempo.
- **Datos reales**: fase y nombre, % iluminado, edad de la lunación, distancia
  Tierra–Luna (con detección de superluna y microluna), diámetro aparente,
  magnitud, libración, elongación del Sol, altura y azimut, salida y puesta.
- **Próximas fases** y **próximos eclipses** (de Luna y de Sol), con la
  visibilidad calculada para tu ubicación.
- **Interacción**: arrastrar para girar y ver la cara oculta, rueda o pellizco
  para acercarse, clic para identificar mares, cráteres y sitios de alunizaje
  (49 accidentes catalogados, del Mare Imbrium al Chang'e 4).
- **Vista**: alterna entre cómo se ve desde tu ubicación (cenit arriba — por eso
  en el hemisferio sur la Luna se ve "al revés") y la orientación geocéntrica
  con el norte celeste arriba.
- **Comparar**: dos fechas lado a lado con la misma cámara.
- **Sonido ambiente** opcional, sintetizado con la Web Audio API.

Atajos: `←` `→` un día, `espacio` animar, `h` hoy, `l` etiquetas, `Esc` cerrar.

## Cómo está hecho

| Archivo | Qué hay adentro |
| --- | --- |
| `js/astro.js` | Capa sobre astronomy-engine. `snapshot()` devuelve, para un instante y un observador, el vector Luna→Sol **en el marco de la pantalla** y la matriz de orientación cuerpo→mundo de la Luna. |
| `js/scene.js` | Escena three.js: esfera en coordenadas selenográficas, shader propio, campo de estrellas, cámara orbital. |
| `js/disc.js` | Miniaturas de la línea de tiempo, dibujadas píxel por píxel con la misma matriz y el mismo vector solar que la escena 3D. |
| `js/features.js` | Catálogo de mares, cráteres y alunizajes con coordenadas selenográficas. |
| `js/app.js` | Estado, panel de datos, línea de tiempo, interacciones. |
| `js/textures.js` | Mapa de albedo y mapa de relieve embebidos como data URI. |

### Las dos decisiones que hacen que se vea bien

**La orientación sale de vectores, no de fórmulas de fase.** Se arma un marco de
pantalla (derecha, arriba, hacia el observador) donde "arriba" es el cenit del
observador o el polo norte celeste, y se proyectan ahí el vector Luna→Sol y los
ejes selenográficos obtenidos del eje de rotación de la Luna. La fase, el ángulo
del limbo iluminado, la libración y la vuelta del hemisferio sur salen todos de
la misma construcción, sin casos especiales.

**La Luna no es lambertiana.** El shader usa una BRDF de Lommel-Seeliger
(dispersión simple en un regolito muy poroso) más el pico de oposición: por eso
la luna llena se ve como un disco plano y parejo, sin el degradé de una bola de
billar. El relieve se calcula derivando el mapa de altura en el fragment shader,
con corrección por `cos(latitud)` para que la proyección equirectangular no
deforme las pendientes cerca de los polos. La cara no iluminada recibe luz
cenicienta, el reflejo de la Tierra, más fuerte cuanto más fina es la fase.

## Créditos y licencias

- Cálculo astronómico: [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 (MIT).
- Render: [three.js](https://threejs.org) r128 (MIT).
- Mapa de albedo: textura lunar de three.js (`examples/textures/planets/moon_1024.jpg`).
- Mapa de relieve: `moonbump1k.jpg` de threex.planets.
  Ambos derivan de mosaicos Clementine/USGS de la NASA.

Las coordenadas de los accidentes lunares son los valores estándar de la IAU
(longitud este positiva).
