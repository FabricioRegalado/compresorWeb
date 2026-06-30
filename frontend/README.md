# Compresor Web de PDF

Aplicacion web local para comprimir archivos PDF desde el navegador. El proyecto esta construido como una herramienta de escritorio/web ligera, inspirada en servicios como iLovePDF, con el objetivo de procesar documentos sin enviarlos a un servidor externo.

La compresion actual se realiza renderizando cada pagina del PDF y reconstruyendo un nuevo archivo con imagenes JPEG optimizadas. Este enfoque funciona con documentos de texto, imagenes o contenido mixto, aunque puede convertir el contenido seleccionable del PDF en imagen.

## Tecnologias

- **Vite**: entorno de desarrollo y empaquetado frontend.
- **React**: construccion de la interfaz y manejo de estado.
- **JavaScript**: lenguaje principal del proyecto.
- **pdfjs-dist**: lectura y renderizado de paginas PDF en el navegador.
- **jsPDF**: generacion del PDF comprimido final.
- **lucide-react**: iconografia de la interfaz.
- **Oxlint**: revision estatica del codigo.

## Funcionalidades

- Carga de archivos PDF mediante selector o arrastrar y soltar.
- Perfiles de compresion: equilibrado, alta compresion y mayor nitidez.
- Ajustes manuales de calidad JPEG y resolucion por pagina.
- Indicador de progreso durante el procesamiento.
- Descarga local del PDF comprimido.
- Procesamiento en el navegador, sin backend.

## Instalacion

```bash
npm install
```

## Ejecucion en desarrollo

```bash
npm run dev
```

La aplicacion queda disponible normalmente en:

```text
http://127.0.0.1:5173
```

## Scripts disponibles

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Consideraciones

La compresion por rasterizado prioriza compatibilidad y ejecucion local. En PDFs compuestos principalmente por texto, el archivo resultante puede perder texto seleccionable, busqueda interna, enlaces o formularios. Para una compresion avanzada que conserve estructura interna del PDF, se requeriria integrar un motor especializado adicional.
