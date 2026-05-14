import React, { useState, useRef, useEffect } from 'react';
import { HiOutlineDocumentAdd, HiOutlineDocument, HiOutlineCloudUpload } from 'react-icons/hi';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function getAuthToken() {
  const authData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
  return authData?.state?.token || null;
}

export default function DocumentUpload({ isOpen, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch existing documents when opened
  useEffect(() => {
    if (isOpen) fetchDocuments();
  }, [isOpen]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/documents/`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(Array.isArray(data) ? data : (data?.documents || []));
      }
    } catch (err) {
      console.warn('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }

      toast.success(`Uploaded "${file.name}" successfully`);
      fetchDocuments();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="doc-upload-overlay" onClick={onClose}>
      <div className="doc-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="doc-upload-header">
          <h3>
            <HiOutlineDocumentAdd size={20} />
            Domain Documents
          </h3>
          <button className="doc-upload-close" onClick={onClose}>x</button>
        </div>

        {/* Drop zone */}
        <div
          className={`doc-upload-dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".txt,.md,.pdf,.csv,.json,.doc,.docx"
          />
          <HiOutlineCloudUpload size={32} className="doc-upload-icon" />
          {uploading ? (
            <p>Uploading and indexing...</p>
          ) : (
            <>
              <p>Drop a file here or click to browse</p>
              <span className="doc-upload-hint">.txt, .md, .pdf, .csv, .json, .doc, .docx</span>
            </>
          )}
        </div>

        {/* Document list */}
        <div className="doc-upload-list">
          {loading ? (
            <p className="doc-upload-empty">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="doc-upload-empty">No documents uploaded yet</p>
          ) : (
            documents.map((doc) => (
              <div key={doc.filename} className="doc-upload-item">
                <HiOutlineDocument size={18} />
                <span className="doc-upload-name">{doc.filename}</span>
                <span className="doc-upload-size">{formatSize(doc.size)}</span>
              </div>
            ))
          )}
        </div>

        <p className="doc-upload-note">
          Uploaded documents are indexed into the RAG knowledge base for AI-powered retrieval.
          Admin role required.
        </p>
      </div>
    </div>
  );
}
