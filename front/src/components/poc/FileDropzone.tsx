'use client';

import React, { useState, useCallback } from 'react';
import styles from './poc.module.css';

interface FileDropzoneProps {
  label: string;
  accept: string;
  onFileSelect: (file: File | null) => void;
  maxSizeMB?: number;
}

export default function FileDropzone({ label, accept, onFileSelect, maxSizeMB = 500 }: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const validateAndSetFile = useCallback((file: File) => {
    setError(null);
    
    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`파일 크기가 너무 큽니다. (최대 ${maxSizeMB}MB)`);
      return;
    }

    // Basic type check (browser might not strictly follow 'accept' internally)
    const fileType = file.type;
    const isVideo = accept.includes('video') && fileType.startsWith('video/');
    const isAudio = accept.includes('audio') && fileType.startsWith('audio/');
    
    if (!isVideo && !isAudio && accept !== '*') {
      // Some browsers might have empty type for some formats, so we check extension as fallback
      const ext = file.name.split('.').pop()?.toLowerCase();
      const validExtensions = accept.split(',').map(a => a.trim().replace('.', ''));
      if (ext && !validExtensions.includes(ext)) {
        setError('지원하지 않는 파일 형식입니다.');
        return;
      }
    }

    setSelectedFile(file);
    onFileSelect(file);
  }, [maxSizeMB, accept, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, [validateAndSetFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    onFileSelect(null);
    setError(null);
  };

  return (
    <div className={styles.dropzoneContainer}>
      <div 
        className={`${styles.dropzone} ${isDragActive ? styles.active : ''} ${selectedFile ? styles.hasFile : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById(`input-${label}`)?.click()}
      >
        <input 
          id={`input-${label}`}
          type="file" 
          accept={accept} 
          className="hidden" 
          style={{ display: 'none' }}
          onChange={handleChange}
        />
        
        {!selectedFile ? (
          <>
            <div className={styles.dropzoneIcon}>
              {accept.includes('video') ? '🎥' : '🎵'}
            </div>
            <div className={styles.dropzoneLabel}>{label}</div>
            <div className={styles.dropzoneHint}>드래그하거나 클릭하여 로드</div>
            <div className={styles.dropzoneHint}>(최대 {maxSizeMB}MB)</div>
          </>
        ) : (
          <div className={styles.fileInfo}>
            <div className={styles.filename}>{selectedFile.name}</div>
            <div className={styles.filesize}>
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </div>
            <button 
              className="mt-4 text-xs text-red-400 hover:text-red-300 transition-colors"
              onClick={removeFile}
            >
              파일 제거
            </button>
          </div>
        )}
      </div>
      {error && <div className={styles.error} style={{ marginTop: '0.5rem' }}>{error}</div>}
    </div>
  );
}
