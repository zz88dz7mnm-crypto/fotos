# Practicá Física I

Sitio estático, sin build ni dependencias ni backend, para practicar de
memoria las fórmulas de las Unidades 1 a 4 de Física I (mediciones, óptica
geométrica, cinemática y dinámica), armado a partir de un formulario con
todas las fórmulas efectivamente usadas en los ejercicios resueltos.

Todo vive en `index.html`. Las fórmulas se renderizan con
[KaTeX](https://katex.org/) desde un CDN; no hay más dependencias.

## Modos de juego

- **🃏 Flashcards** — se muestra el nombre de la fórmula, pensás la
  respuesta y das vuelta la tarjeta para revelarla. Marcás si la sabías o
  no.
- **🎯 ¿Cuál fórmula?** — dado el nombre, elegís la fórmula correcta entre
  4 opciones.
- **🏷️ ¿Cómo se llama?** — dada la fórmula, elegís su nombre correcto
  entre 4 opciones.
- **⌨️ Escribila** — dado el nombre, escribís la fórmula a mano (sin
  necesidad de LaTeX: alcanza con `*`, `/`, `^`, `sen()`, `cos()`,
  `sqrt()`); la comparación es flexible con la notación real.

Podés filtrar por unidad (U1–U4) en cualquier momento.

## Progreso

Cada fórmula tiene un "peso": cuando la fallás pesa más y aparece con más
frecuencia; cuando la acertás pesa menos.

Además, cada fórmula lleva una **racha de aciertos seguidos** (se ve como
🔥 x/3 en la tarjeta). Al llegar a **3 aciertos consecutivos** la fórmula
queda marcada como **dominada** y deja de aparecer en el pool de práctica.
Un solo error corta la racha a 0. Cuando dominás todas las fórmulas
activas (según el filtro de unidad elegido), la app te lo dice y te deja
un botón para repasarlas todas de nuevo.

El progreso (aciertos, errores, peso, racha) se guarda en `localStorage`
del navegador, así que es individual por dispositivo. Se puede reiniciar
del todo desde el enlace al pie de la página.

## Desplegar

Conectás el repo a Vercel y listo — es HTML estático, no requiere ningún
build step.
