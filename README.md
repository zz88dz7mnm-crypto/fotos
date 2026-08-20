# Filtro 35mm

Web de una sola página que aplica automáticamente un look de fotografía analógica
(carrete 35mm tipo Kodak Gold / Fuji Superia escaneado) a cualquier imagen.

**Todo el procesado ocurre en el navegador** — la foto nunca se sube a ningún servidor.

## Uso

Abre `index.html` en el navegador. No hay build, ni dependencias, ni backend.

Arrastra una foto (o pégala con Ctrl+V, o haz clic para elegirla), se procesa
sola y ya puedes descargarla en JPG.

Controles:

| Control | Qué hace |
|---|---|
| **Intensidad** | Mezcla entre el original (0%) y el filtro completo (100%), hasta 150% |
| **Grano** | Densidad del grano de película |
| **Ver original** | Compara antes/después |
| **Marco blanco** | Añade el borde crema de foto impresa |

## El filtro

Un único preset, aplicado en este orden:

1. **Balance de blancos** — cast ligeramente verdoso/frío de negativo color.
2. **Curva de tono** — negros levantados (nunca llegan a 0), *shoulder* exponencial
   que comprime suavemente las altas luces, y −12% de contraste global.
3. **Split-toning** — sombras hacia cian/verde, luces hacia naranja, con peso
   cuadrático según la luminancia del píxel.
4. **Desaturación selectiva** — −20% general, sólo −8% en los azules, que
   conservan más cuerpo (cielo, agua).
5. **Aberración cromática** radial — el canal rojo se desplaza hacia fuera y el
   azul hacia dentro, proporcional al cuadrado de la distancia al centro.
6. **Halación** — las altas luces (>72% de luminancia) sangran en cálido mediante
   un desenfoque compuesto en modo `screen`.
7. **Softness** — pérdida leve de nitidez, como una lente de compacta.
8. **Grano** de luminancia, con más presencia en las sombras.
9. **Viñeta** suave, ~−13% en las esquinas.

Las imágenes de más de 3200px en su lado largo se reescalan para el procesado.
Se respeta la orientación EXIF, así que las fotos de móvil no salen giradas.
