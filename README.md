# Golden Coast

Dos piezas del mismo sistema:

- **`index.html`** — el revelador: subís una foto, la ajustás con los sliders y la descargás.
- **`diario.html`** — el diario fotográfico compartido: subís una foto, sale revelada sola
  y entra a una galería tipo Polaroid. Publicado como artifact con estado compartido,
  así que quien tenga el link ve las fotos y puede sumar las suyas. Abierto como archivo
  suelto funciona igual, guardando en el navegador.

---

# Revelado 35mm

Web de una sola página que revela cualquier foto con estética de carrete
analógico: luz cálida de hora dorada, luces ámbar, sombras con un punto de
cian, halación y grano fino.

El filtro está calibrado para ser **contenido**: mantiene el contraste, los
negros con cuerpo y la saturación del cielo y el agua. La fuga de luz, el
polvo, el marco y el sello de fecha son extras opcionales, apagados por
defecto.

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
| R | 0.030 | 1.000 | 1.00 |
| G | 0.028 | 0.994 | 1.00 |
| B | 0.055 | 0.968 | 0.99 |

Orden de revelado:

1. **Aberración cromática** radial — el rojo se desplaza hacia fuera y el azul
   hacia dentro, proporcional al cuadrado de la distancia al centro.
2. **Curvas por canal** con hombro exponencial en las luces y −4% de contraste.
3. **Split-toning** — sombras a cian/verde, luces a ámbar, peso cuadrático
   según luminancia; más un velo sepia en los medios (el papel amarillea).
4. **Desaturación** al 90%, con los azules al 98% para que el cielo y el agua
   conserven cuerpo.
5. **Halación** — las luces por encima del 74% sangran en rojo-naranja mediante
   desenfoque compuesto en `screen`.
6. **Velo cálido** — neblina lechosa sobre toda la imagen.
7. **Fuga de luz** desde una esquina, con banda en el borde *(opcional)*.
8. **Softness** de lente de compacta.
9. **Polvo y rayas** de escaneo *(opcional)*.
10. **Grano** de luminancia con pizca de grano de color, más denso en sombras.
11. **Viñeta** ~−13% en las esquinas.
12. **Sello de fecha** quemado en modo `lighter` *(opcional)*.

El polvo y la fuga usan un PRNG con semilla fija por imagen, así que no bailan
al mover los sliders.

Las imágenes de más de 3000px en su lado largo se reescalan para el revelado.
Se respeta la orientación EXIF, así que las fotos de móvil no salen giradas.
