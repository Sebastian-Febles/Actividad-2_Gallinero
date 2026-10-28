# Gallinero Climático 🥚

Aplicación web para quienes tienen gallinas en casa. Consulta el pronóstico de 7 días de tu ciudad, calcula la **producción estimada de huevos** según el calor y las horas de luz, y te permite llevar un **registro diario** de los huevos que recoges.

## API utilizada
[Open-Meteo](https://open-meteo.com/) (gratuita, sin clave de API):
- Geocodificación: `https://geocoding-api.open-meteo.com/v1/search`
- Pronóstico: `https://api.open-meteo.com/v1/forecast` (temperatura máxima/mínima y duración de la luz del día)

Como no requiere clave, no hay secretos en el repositorio.

## Funciones
- Búsqueda de ciudad y pronóstico de 7 días con nivel de estrés por calor y consejos.
- Estimación de huevos por día según número de gallinas, temperatura y horas de luz.
- Registro de huevos guardado en el navegador (`localStorage`), con total, promedio de 7 días y gráfica.
- Manejo de errores: sin conexión, tiempo de espera agotado, límite de peticiones (429), ciudad no encontrada y respuesta vacía.

## Declaración de uso de IA
> Completa esta sección con tu caso real antes de entregar.
- **Herramientas usadas:** (ej. Claude, Copilot, Codespaces)
- **Para qué las usé:** (ej. generar la estructura inicial, explicar errores, documentar)
- **Lo que hice sin ayuda de IA:** (ej. ajustar las fórmulas de estimación, el registro de huevos, pruebas manuales)

## Estructura
```
index.html   → estructura de la página
style.css    → estilos
app.js       → llamadas a la API, lógica del gallinero y registro
```
