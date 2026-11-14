import {
  PRODUCT_ELIGIBLE_PROJECT_STATUSES,
  PRODUCT_TITLE_MAX_LENGTH,
  PRODUCT_TYPES,
  PRODUCT_URL_DOI_MAX_LENGTH,
  type ProductTypeValue,
} from './products.constants.js';

export interface RegisterProductPolicyInput {
  productType: string;
  urlDoi: string;
  title?: string | null;
  authors: string[];
}

export interface ProductValidationIssue {
  field: string;
  message: string;
}

/** Expresion regular permisiva para DOI (10.xxxx/...) o URLs HTTP/HTTPS validas. */
const DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i;
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export function isValidUrlOrDoi(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return DOI_REGEX.test(trimmed) || URL_REGEX.test(trimmed);
}

export function isSupportedProductType(type: string): type is ProductTypeValue {
  return (PRODUCT_TYPES as readonly string[]).includes(type);
}

export function isProjectEligibleForProduct(projectStatus: string): boolean {
  return (PRODUCT_ELIGIBLE_PROJECT_STATUSES as readonly string[]).includes(
    projectStatus,
  );
}

export function validateRegisterProductInput(
  input: RegisterProductPolicyInput,
): ProductValidationIssue[] {
  const issues: ProductValidationIssue[] = [];

  if (!isSupportedProductType(input.productType)) {
    issues.push({
      field: 'productType',
      message:
        'Tipo de producto invalido. Valores permitidos: journal_article, conference_presentation, software, patent, thesis.',
    });
  }

  if (!input.urlDoi || typeof input.urlDoi !== 'string' || input.urlDoi.trim().length === 0) {
    issues.push({
      field: 'urlDoi',
      message: 'El enlace URL o DOI es obligatorio.',
    });
  } else if (input.urlDoi.trim().length > PRODUCT_URL_DOI_MAX_LENGTH) {
    issues.push({
      field: 'urlDoi',
      message: `El enlace URL o DOI no puede exceder ${PRODUCT_URL_DOI_MAX_LENGTH} caracteres.`,
    });
  } else if (!isValidUrlOrDoi(input.urlDoi)) {
    issues.push({
      field: 'urlDoi',
      message: 'Formato invalido de URL o DOI (debe ser una URL valida o formato 10.xxxx/...).',
    });
  }

  if (input.title && input.title.trim().length > PRODUCT_TITLE_MAX_LENGTH) {
    issues.push({
      field: 'title',
      message: `El titulo no puede exceder ${PRODUCT_TITLE_MAX_LENGTH} caracteres.`,
    });
  }

  if (!Array.isArray(input.authors) || input.authors.length === 0) {
    issues.push({
      field: 'authors',
      message: 'Debes especificar al menos un autor para el producto.',
    });
  }

  return issues;
}
