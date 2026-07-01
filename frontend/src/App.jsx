import { useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileArchive,
  FileText,
  Gauge,
  Loader2,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  Zap,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import './App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const MAX_CANVAS_SIDE = 4096
const MAX_CANVAS_PIXELS = 12000000
const MIN_RENDER_SCALE = 0.6

const compressionProfiles = {
  balanced: {
    label: 'Equilibrado',
    description: 'Buena lectura con menos peso para uso diario.',
    quality: 0.66,
    scale: 1.35,
  },
  strong: {
    label: 'Alta compresion',
    description: 'Reduce mas el peso, ideal para envio por correo.',
    quality: 0.46,
    scale: 1.05,
  },
  sharp: {
    label: 'Mas nitido',
    description: 'Conserva mejor detalles pequenos con menor ahorro.',
    quality: 0.82,
    scale: 1.65,
  },
}

const formatBytes = (bytes) => {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const buildOutputName = (name) => {
  const cleanName = name.replace(/\.pdf$/i, '')
  return `${cleanName || 'documento'}-comprimido.pdf`
}

const getSafeRenderScale = (pageViewport, requestedScale) => {
  const sideLimit = Math.min(
    MAX_CANVAS_SIDE / pageViewport.width,
    MAX_CANVAS_SIDE / pageViewport.height,
  )
  const areaLimit = Math.sqrt(MAX_CANVAS_PIXELS / (pageViewport.width * pageViewport.height))

  return Math.max(MIN_RENDER_SCALE, Math.min(requestedScale, sideLimit, areaLimit))
}

const canvasToJpegBlob = (canvas, imageQuality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error('No se pudo convertir la pagina renderizada a imagen.'))
      },
      'image/jpeg',
      imageQuality,
    )
  })

function App() {
  const [file, setFile] = useState(null)
  const [profileKey, setProfileKey] = useState('balanced')
  const [quality, setQuality] = useState(compressionProfiles.balanced.quality)
  const [scale, setScale] = useState(compressionProfiles.balanced.scale)
  const [isDragging, setIsDragging] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const selectedProfile = compressionProfiles[profileKey]
  const hasResult = Boolean(result)

  const savings = useMemo(() => {
    if (!file || !result) return 0
    return Math.max(0, Math.round((1 - result.size / file.size) * 100))
  }, [file, result])

  const assignFile = (selectedFile) => {
    if (!selectedFile) return

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Selecciona un archivo PDF valido.')
      return
    }

    if (result?.url) {
      URL.revokeObjectURL(result.url)
    }

    setFile(selectedFile)
    setResult(null)
    setError('')
    setProgress(0)
  }

  const handleInputChange = (event) => {
    assignFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleProfileChange = (key) => {
    const profile = compressionProfiles[key]
    setProfileKey(key)
    setQuality(profile.quality)
    setScale(profile.scale)
    setResult(null)
  }

  const resetWorkspace = () => {
    if (result?.url) {
      URL.revokeObjectURL(result.url)
    }

    setFile(null)
    setResult(null)
    setError('')
    setProgress(0)
    setIsCompressing(false)
  }

  const compressPdf = async () => {
    if (!file || isCompressing) return

    setIsCompressing(true)
    setError('')
    setResult(null)
    setProgress(4)

    try {
      const source = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: source }).promise
      let output = null

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const pageViewport = page.getViewport({ scale: 1 })
        const renderScale = getSafeRenderScale(pageViewport, scale)
        const viewport = page.getViewport({ scale: renderScale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { alpha: false })

        if (!context) {
          throw new Error('No se pudo crear el contexto de renderizado.')
        }

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          background: '#ffffff',
        }).promise

        const imageBlob = await canvasToJpegBlob(canvas, quality)
        const imageBytes = new Uint8Array(await imageBlob.arrayBuffer())
        const orientation = pageViewport.width > pageViewport.height ? 'landscape' : 'portrait'
        const pageSize = [pageViewport.width, pageViewport.height]

        if (!output) {
          output = new jsPDF({
            unit: 'pt',
            format: pageSize,
            orientation,
            compress: true,
          })
        } else {
          output.addPage(pageSize, orientation)
        }

        output.addImage(imageBytes, 'JPEG', 0, 0, pageViewport.width, pageViewport.height, undefined, 'MEDIUM')

        canvas.width = 0
        canvas.height = 0
        page.cleanup()
        setProgress(Math.round((pageNumber / pdf.numPages) * 100))
      }

      if (!output) {
        throw new Error('El PDF no contiene paginas para comprimir.')
      }

      const blob = output.output('blob')
      const url = URL.createObjectURL(blob)

      setResult({
        url,
        size: blob.size,
        name: buildOutputName(file.name),
        pages: pdf.numPages,
      })
      setProgress(100)
    } catch (caughtError) {
      console.error(caughtError)
      setError('No se pudo comprimir el PDF. Intenta con otro archivo o baja la calidad.')
      setProgress(0)
    } finally {
      setIsCompressing(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <FileArchive size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 className="eyebrow">Reductor de PDF </h1>
        </div>
      </header>

      <section className="workspace" aria-label="Herramienta de compresion">
        <div
          className={`dropzone ${isDragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault()
            setIsDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            assignFile(event.dataTransfer.files?.[0])
          }}
        >
          <input
            ref={inputRef}
            className="file-input"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleInputChange}
          />

          <div className="dropzone-icon">
            {file ? <FileText size={34} aria-hidden="true" /> : <UploadCloud size={36} aria-hidden="true" />}
          </div>

          <div className="dropzone-copy">
            <h2>{file ? file.name : 'Arrastra tu PDF aqui'}</h2>
            <p>{file ? `${formatBytes(file.size)} listo para comprimir` : 'O selecciona un archivo desde tu equipo.'}</p>
          </div>

          <button type="button" className="primary-button" onClick={() => inputRef.current?.click()}>
            <UploadCloud size={18} aria-hidden="true" />
            Seleccionar PDF
          </button>
        </div>

        <aside className="controls-panel" aria-label="Ajustes de compresion">
          <div className="panel-heading">
            <SlidersHorizontal size={20} aria-hidden="true" />
            <h2>Ajustes</h2>
          </div>

          <div className="profile-grid" role="radiogroup" aria-label="Perfil de compresion">
            {Object.entries(compressionProfiles).map(([key, profile]) => (
              <button
                key={key}
                type="button"
                className={`profile-option ${profileKey === key ? 'is-active' : ''}`}
                onClick={() => handleProfileChange(key)}
                role="radio"
                aria-checked={profileKey === key}
              >
                <span>{profile.label}</span>
                <small>{profile.description}</small>
              </button>
            ))}
          </div>

          <label className="range-control">
            <span>
              Calidad JPEG
              <strong>{Math.round(quality * 100)}%</strong>
            </span>
            <input
              type="range"
              min="0.3"
              max="0.92"
              step="0.02"
              value={quality}
              onChange={(event) => {
                setQuality(Number(event.target.value))
                setResult(null)
              }}
            />
          </label>

          <label className="range-control">
            <span>
              Resolucion por pagina
              <strong>{scale.toFixed(2)}x</strong>
            </span>
            <input
              type="range"
              min="0.8"
              max="1.9"
              step="0.05"
              value={scale}
              onChange={(event) => {
                setScale(Number(event.target.value))
                setResult(null)
              }}
            />
          </label>

          <div className="privacy-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Todo se procesa en tu navegador.</span>
          </div>
        </aside>
      </section>

      <section className="action-band" aria-label="Estado de compresion">
        <div className="status-block">
          {isCompressing ? (
            <Loader2 className="spin" size={22} aria-hidden="true" />
          ) : hasResult ? (
            <CheckCircle2 size={22} aria-hidden="true" />
          ) : error ? (
            <AlertCircle size={22} aria-hidden="true" />
          ) : (
            <Gauge size={22} aria-hidden="true" />
          )}

          <div>
            <strong>
              {isCompressing
                ? `Comprimiendo... ${progress}%`
                : hasResult
                  ? `Ahorro estimado: ${savings}%`
                  : error || selectedProfile.description}
            </strong>
            <p>
              {hasResult
                ? `${formatBytes(file.size)} -> ${formatBytes(result.size)} en ${result.pages} pagina(s).`
                : 'Los PDFs con mucho texto vectorial pueden perder texto seleccionable al recomprimirse como imagen.'}
            </p>
          </div>
        </div>

        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="button-row">
          <button type="button" className="secondary-button" onClick={resetWorkspace} disabled={!file && !error}>
            <RotateCcw size={18} aria-hidden="true" />
            Reiniciar
          </button>

          {hasResult ? (
            <a className="primary-button download-link" href={result.url} download={result.name}>
              <Download size={18} aria-hidden="true" />
              Descargar PDF
            </a>
          ) : (
            <button type="button" className="primary-button" onClick={compressPdf} disabled={!file || isCompressing}>
              <Zap size={18} aria-hidden="true" />
              Comprimir
            </button>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <p>
          &copy; {new Date().getFullYear()} Oscar Fabricio Regalado P&eacute;rez. Todos los derechos reservados.
        </p>
      </footer>
    </main>
  )
}

export default App
