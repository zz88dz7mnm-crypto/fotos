# Golden Coast

Sitio estático, sin build ni dependencias ni backend. Todo el procesado de
imagen ocurre en el navegador: las fotos no se suben a ningún servidor.

| ruta | archivo | qué es |
|---|---|---|
| `/` · `/muro` | `index.html` | el muro: fotos de punta a punta, sin marcos ni texto |
| `/subir` | `index.html` | la página para sumar fotos al muro |
| `/revelador` | `revelador.html` | el revelador: subís, ajustás con sliders y descargás |

El muro y la carga son el mismo archivo: qué página se ve lo decide la URL —
vale la ruta (`/subir`), la query (`?subir`) o el fragmento (`#subir`).

## Desplegar

Conectás el repo a Vercel y listo; el `vercel.json` deja las rutas limpias.

**Ojo:** servido desde Vercel el muro **no es compartido** — las fotos quedan
en el navegador de cada persona. El muro colectivo necesita la capability de
artifact de Claude, o un backend propio.

---

# El filtro

Un único preset, calibrado para ser **contenido**: mantiene el contraste, los
negros con cuerpo y la saturación del cielo y el agua.

Lo que le da el carácter de película real son las **curvas independientes por
canal**: cada canal tiene su propio suelo y su propio techo, así que el azul
arranca alto y termina bajo — de ahí las sombras con un punto de cian y las
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
   según luminancia; más un velo sepia en los medios.
4. **Desaturación** al 90%, con los azules al 98% para que el cielo y el agua
   conserven cuerpo.
5. **Halación** — las luces por encima del 74% sangran en rojo-naranja.
6. **Tinte sol/terracota** en `soft-light`, muy leve.
7. **Grano** de luminancia, más denso en sombras.
8. **Viñeta** ~−13% en las esquinas.

El revelador suma además, como extras opcionales: fuga de luz, polvo y rayas
de escaneo, marco de foto impresa y sello de fecha de cámara compacta.

Se respeta la orientación EXIF, así que las fotos de móvil no salen giradas.
