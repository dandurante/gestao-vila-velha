import type { Unit } from "./units";

export interface CompanyInfo {
  razaoSocial: string;
  cnpj: string;
  cidade: string;
  estado: string;
}

/**
 * Dados corporativos por loja, usados para emissão de recibos.
 * Cada loja sabe qual empresa contratante usar e em qual cidade/estado opera.
 */
export const COMPANY_BY_UNIT: Record<Unit, CompanyInfo> = {
  "Praia da Costa": {
    razaoSocial: "AJAX SERVIÇOS DE ENTREGA LTDA.",
    cnpj: "52.311.860/0001-40",
    cidade: "Vitória",
    estado: "ES",
  },
  Itaparica: {
    razaoSocial: "AJAX SERVIÇOS DE ENTREGA LTDA.",
    cnpj: "52.311.860/0001-40",
    cidade: "Vitória",
    estado: "ES",
  },
};

export function getCompanyByUnit(unit: string): CompanyInfo | undefined {
  return COMPANY_BY_UNIT[unit as Unit];
}
