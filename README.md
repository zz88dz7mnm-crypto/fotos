# Revelado 35mm

Web de una sola página que revela cualquier foto con estética de carrete
analógico de los 90: emulsión desvaída, dominante ámbar, fuga de luz, polvo,
grano y sello de fecha.

**Todo el procesado ocurre en el navegador** — la foto nunca se sube a ningún servidor.

## Uso

Abre `index.html` en el navegador. No hay build, ni dependencias, ni backend.

Arrastra una foto (o pégala con Ctrl+V, o haz clic para elegirla), se revela
sola y ya puedes descargarla en JPG.

| Control | Qué hace |
|---|---|
| **Intensidad** | Mezcla entre el original (0%) y el revelado completo (100%), hasta 150% |
| **Grano** | Densidad del grano de emulsión |
| **Ver original** | Compara antes/después |
| **Fuga de luz** | Mancha ámbar en una esquina + banda cálida en el borde |
| **Polvo** | Motas y rayas de escaneo |
| **Marco** | Borde crema de foto impresa |
| **Fecha** | Sello naranja de cámara compacta, editable |

## El filtro

Un único preset. Lo que le da el carácter de película real son las **curvas
independientes por canal**: cada canal tiene su propio suelo y su propio techo,
así que el azul arranca alto y termina bajo — de ahí las sombras cian y las
luces ámbar, sin tocar el tono manualmente.

| Canal | Suelo | Techo | Gamma |
|---|---|---|---|
| R | 0.055 | 1.000 | 1.03 |
| G | 0.050 | 0.980 | 1.00 |
| B | 0.115 | 0.910 | 0.96 |

Orden de revelado:

1. **Aberración cromática** radial — el rojo se desplaza hacia fuera y el azul
   hacia dentro, proporcional al cuadrado de la distancia al centro.
2. **Curvas por canal** con hombro exponencial en las luces y −16% de contraste.
3. **Split-toning** — sombras a cian/verde, luces a ámbar, peso cuadrático
   según luminancia; más un velo sepia en los medios (el papel amarillea).
4. **Desaturación** al 72%, con los azules al 85% para que el cielo y el agua
   conserven cuerpo.
5. **Halación** — las luces por encima del 66% sangran en rojo-naranja mediante
   desenfoque compuesto en `screen`.
6. **Velo cálido** — neblina lechosa sobre toda la imagen.
7. **Fuga de luz** desde una esquina, con banda en el borde.
8. **Softness** de lente de compacta.
9. **Polvo y rayas** de escaneo.
10. **Grano** de luminancia con pizca de grano de color, más denso en sombras.
11. **Viñeta** ~−20% en las esquinas.
12. **Sello de fecha** quemado en modo `lighter`.

El polvo y la fuga usan un PRNG con semilla fija por imagen, así que no bailan
al mover los sliders.

Las imágenes de más de 3000px en su lado largo se reescalan para el revelado.
Se respeta la orientación EXIF, así que las fotos de móvil no salen giradas.
