import { describe, expect, it } from 'vitest';
import { DOCUMENT_ERROR_CODES, MAX_FILE_BYTES } from './document-upload.constants.js';
import { MAX_FILE_BYTES as MAX_FILE_BYTES_PROJECTS } from '../projects/projects.constants.js';
import {
  checkProjectQuota,
  detectFileType,
  extractFileExtension,
  validateEvidenceUpload,
} from './document-upload.policy.js';

const MAX_FILE_BYTES_TEST = MAX_FILE_BYTES_PROJECTS ?? MAX_FILE_BYTES;

describe('extractFileExtension', () => {
  it('extrae extension en minusculas', () => {
    expect(extractFileExtension('reporte.PDF')).toBe('pdf');
    expect(extractFileExtension('evidencia.JPEG')).toBe('jpeg');
  });

  it('devuelve null sin extension o con punto final', () => {
    expect(extractFileExtension('archivo')).toBeNull();
    expect(extractFileExtension('archivo.')).toBeNull();
    expect(extractFileExtension('.bashrc')).toBeNull();
  });
});

describe('detectFileType (Magic Numbers)', () => {
  const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x01, 0x02]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const xlsx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x05, 0x06]);
  const executatble = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ (EXE)

  it('detecta PDF', () => expect(detectFileType(pdf)).toBe('pdf'));
  it('detecta PNG', () => expect(detectFileType(png)).toBe('png'));
  it('detecta JPG', () => expect(detectFileType(jpg)).toBe('jpg'));
  it('detecta XLSX', () => expect(detectFileType(xlsx)).toBe('xlsx'));
  it('rechaza ejecutable disfrazado', () => expect(detectFileType(executatble)).toBeNull());
  it('rechaza buffer vacio', () => expect(detectFileType(Buffer.alloc(0))).toBeNull());
});

describe('validateEvidenceUpload (RF-016, RNF-005)', () => {
  const validPdf = {
    buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
    originalname: 'evidencia.pdf',
    size: 100,
  };

  const validPng = {
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    originalname: 'grafico.png',
    size: 100,
  };

  const validXlsx = {
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    originalname: 'datos.xlsx',
    size: 100,
  };

  it('acepta PDF, PNG y XLSX validos', () => {
    expect(validateEvidenceUpload(validPdf)).toEqual([]);
    expect(validateEvidenceUpload(validPng)).toEqual([]);
    expect(validateEvidenceUpload(validXlsx)).toEqual([]);
  });

  it('rechaza extension no permitida', () => {
    const issues = validateEvidenceUpload({
      ...validPdf,
      originalname: 'script.sh',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(DOCUMENT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE);
  });

  it('rechaza extension que miente sobre el contenido (fraude)', () => {
    const issues = validateEvidenceUpload({
      ...validPdf,
      originalname: 'imagen.png',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(DOCUMENT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE);
    expect(issues[0].message).toContain('no coincide con su extension');
  });

  it('rechaza archivo mas de 25 MB', () => {
    const issues = validateEvidenceUpload({
      ...validPdf,
      size: MAX_FILE_BYTES_TEST + 1,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(DOCUMENT_ERROR_CODES.PAYLOAD_TOO_LARGE);
    expect(issues[0].httpStatus).toBe(413);
  });

  it('acepta archivo exactamente de 25 MB', () => {
    expect(
      validateEvidenceUpload({ ...validPdf, size: MAX_FILE_BYTES_TEST }),
    ).toEqual([]);
  });

  it('reporta multiples problemas a la vez', () => {
    // extension permitida pero contenido no coincide + tamanio excedido
    const issues = validateEvidenceUpload({
      buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]), // PDF magico
      originalname: 'malo.png', // dice ser PNG pero es PDF
      size: MAX_FILE_BYTES_TEST + 1,
    });
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });

  it('devuelve las extensiones permitidas en el mensaje de error', () => {
    const issues = validateEvidenceUpload({
      ...validPdf,
      originalname: 'malo.exe',
    });
    const allowed = [
      'pdf', 'png', 'jpg', 'jpeg', 'xlsx',
    ];
    allowed.forEach((ext) => {
      expect(issues[0].message).toContain(ext);
    });
  });
});

describe('checkProjectQuota (RNF-005)', () => {
  it('permite cuando no se supera la cuota', () => {
    expect(checkProjectQuota(400 * 1024 * 1024, 50 * 1024 * 1024)).toBeNull();
  });

  it('rechaza cuando se supera la cuota de 500 MB', () => {
    const issue = checkProjectQuota(490 * 1024 * 1024, 20 * 1024 * 1024);
    expect(issue?.code).toBe(DOCUMENT_ERROR_CODES.PAYLOAD_TOO_LARGE);
    expect(issue?.httpStatus).toBe(413);
  });
});
