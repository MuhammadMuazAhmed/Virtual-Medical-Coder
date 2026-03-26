import { useState, useRef } from 'react'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
      if (!validTypes.includes(selectedFile.type)) {
        alert('Please select a valid image (JPEG, PNG, GIF) or PDF file.')
        return
      }

      setFile(selectedFile)

      if (selectedFile.type.startsWith('image/')) {
        const url = URL.createObjectURL(selectedFile)
        setPreviewUrl(url)
      } else {
        setPreviewUrl('')
      }
    }
  }

  const handleAreaClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleUpload = () => {
    if (!file) {
      alert('Please select a file first.')
      return
    }
    console.log('Uploading file:', file.name)
    alert(`File "${file.name}" ready to be uploaded!`)
  }

  return (
    <main style={{ minHeight: '100svh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, padding: 0 }}>
      <div style={{ maxWidth: '450px', width: '90%', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow)', boxSizing: 'border-box' }}>
        <h1 style={{ marginTop: 0, marginBottom: '24px', fontSize: '28px', color: 'var(--text-h)', textAlign: 'center' }}>Upload Document</h1>

        <div
          onClick={handleAreaClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            border: `2px dashed ${isHovered ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isHovered ? 'var(--accent-bg)' : 'transparent',
            transition: 'all 0.2s ease',
            marginBottom: '24px'
          }}
        >
          <svg style={{ width: '40px', height: '40px', color: isHovered ? 'var(--accent)' : 'var(--text)', marginBottom: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p style={{ margin: 0, fontSize: '16px', color: 'var(--text-h)', fontWeight: '500' }}>Click to select a file</p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text)' }}>Supported formats: JPEG, PNG, GIF, PDF</p>

          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
        </div>

        {file && (
          <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--text-h)', fontWeight: '600' }}>Selected File</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px' }}>
              <span style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{file.name}</span>
              <span style={{ color: 'var(--accent)', fontWeight: '500' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>

            {previewUrl && (
              <div style={{ textAlign: 'center', background: 'var(--code-bg)', borderRadius: '8px', padding: '8px' }}>
                <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', objectFit: 'contain' }} />
              </div>
            )}

            {file.type === 'application/pdf' && (
              <div style={{ padding: '24px 16px', background: 'var(--code-bg)', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <svg style={{ width: '48px', height: '48px', color: '#ff4b4b', marginBottom: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span style={{ fontSize: '14px', color: 'var(--text-h)', fontWeight: '500' }}>PDF Document Selected</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file}
          style={{
            width: '100%',
            padding: '14px',
            background: file ? 'var(--accent)' : 'var(--code-bg)',
            color: file ? '#fff' : 'var(--text)',
            border: file ? 'none' : '1px solid var(--border)',
            borderRadius: '12px',
            cursor: file ? 'pointer' : 'not-allowed',
            fontWeight: '600',
            fontSize: '16px',
            transition: 'all 0.2s ease',
            opacity: file ? 1 : 0.6
          }}
        >
          {file ? 'Upload File' : 'Select a file first'}
        </button>
      </div>
    </main>
  )
}

export default App
