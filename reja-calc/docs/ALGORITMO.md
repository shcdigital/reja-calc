# Algoritmo de optimización de cortes

Problema: corte unidimensional (Cutting Stock / Bin Packing) por sección de perfil. Las secciones nunca se mezclan
(clave `kind:medidas`) y cada pieza sale de un único tramo continuo (no se unen recortes).

**Plan de obra:** en una obra con varias rejas, las piezas de **todas** las rejas se juntan y se empaquetan por sección
en un único plan. El `id` de cada pieza se prefija con el id de su reja (`<rejaId>:<idLocal>`) para poder atribuirla;
el empacar piezas de varias rejas juntas nunca da más caños que planificarlas por separado (misma capacidad y menos fragmentación).

1. **Normalización:** aritmética en décimas de mm (enteros). Cada pieza pesa `p + k` y el tramo vale `T + k`
   (equivale a `Σp + (n−1)·k ≤ T`).
2. **Sobrantes del inventario** (si se habilita): para cada sobrante, de mayor a menor, se elige el subconjunto de piezas que mejor lo llena
   (subset-sum exacto por programación dinámica). Solo se ofrecen sobrantes de la misma sección.
3. **Cota inferior:** `ceil(Σ(p + k) / (T + k))`.
4. **Heurísticas** FFD y BFD; se toma la mejor. Si alcanza la cota inferior, es óptima.
5. **Ramificación y poda exacta** (piezas en orden decreciente, descarte de simetrías por espacio libre repetido,
   poda por cota de espacio restante). Tope de 400.000 nodos (determinista, no depende del reloj). Si termina sin llegar al tope,
   la cantidad de caños queda **demostrada óptima**; si no, se informa «óptimo no comprobado».
6. **Mejora de sobrantes:** mover/intercambiar piezas entre tramos sin aumentar la cantidad de caños, minimizando
   (a) cantidad de caños, (b) sobrantes chicos (< largo mínimo reutilizable), (c) maximizando la concentración del sobrante
   (suma de cuadrados), para dejar pocos sobrantes largos y reutilizables.

El resultado es reproducible: la misma entrada produce siempre el mismo plan.
