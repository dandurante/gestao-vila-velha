export const UNITS = [
  "Praia da Costa",
  "Itaparica",
] as const;

export type Unit = (typeof UNITS)[number];

export interface UnitInfo {
  razaoSocial: string;
  fantasia?: string;
  cnpj: string;
  endereco: string;
  cep: string;
  state: "SP" | "ES";
}

export const UNIT_DISPLAY_NAMES: Record<Unit, string> = {
  "Praia da Costa": "Praia da Costa",
  Itaparica: "Itaparica",
};

export const getUnitDisplayName = (unit: string): string => {
  return UNIT_DISPLAY_NAMES[unit as Unit] || unit;
};

export const UNIT_DETAILS: Record<Unit, UnitInfo> = {
  "Praia da Costa": {
    state: "ES",
    razaoSocial: "AJAX SERVIÇOS DE ENTREGA LTDA.",
    cnpj: "52.311.860/0001-40",
    endereco: "Rua General Osório, nº 127, Edif. A Gazeta, sala 902, Centro, Vitória/ES",
    cep: "29010-030",
  },
  Itaparica: {
    state: "ES",
    razaoSocial: "AJAX SERVIÇOS DE ENTREGA LTDA.",
    cnpj: "52.311.860/0001-40",
    endereco: "Rua General Osório, nº 127, Edif. A Gazeta, sala 902, Centro, Vitória/ES",
    cep: "29010-030",
  },
};

export const getUnitsByState = (state: "SP" | "ES") => {
  return UNITS.filter((u) => UNIT_DETAILS[u].state === state);
};
