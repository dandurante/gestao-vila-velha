import { createServerFn } from "@tanstack/react-start";

const ZAPSIGN_TOKEN = "0b65b8cd-104c-45f8-b273-3baa8d14dd3da9b9d31b-e2fb-49f5-b0d6-88e56bbd528f";
const ZAPSIGN_API = "https://api.zapsign.com.br/api/v1";

export interface ZapSignListDoc {
  token: string;
  name: string;
  status: string;
  created_at: string;
  last_update_at?: string;
  signed_file?: string;
  original_file?: string;
  signers?: Array<{ name: string; email: string; status: string }>;
}

/**
 * Lista todos os documentos assinados na ZapSign (paginado).
 * Filtra por status=signed.
 */
export const listSignedZapSignDocs = createServerFn({ method: "GET" }).handler(async () => {
  const allDocs: ZapSignListDoc[] = [];
  let page = 1;
  const maxPages = 20; // Segurança: até 500 docs

  while (page <= maxPages) {
    const url = `${ZAPSIGN_API}/docs/?page=${page}&status=signed`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ZAPSIGN_TOKEN}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ZapSign API erro ${res.status}: ${errText}`);
    }

    const data: any = await res.json();
    const results: ZapSignListDoc[] = data.results || [];
    allDocs.push(...results);

    if (!data.next || results.length === 0) break;
    page++;
  }

  return { docs: allDocs };
});

/**
 * Lista os documentos mais recentes (assinados e pendentes) da ZapSign.
 * Busca as primeiras 3 páginas para fins de conciliação rápida em tempo real.
 */
export const listRecentZapSignDocs = createServerFn({ method: "GET" }).handler(async () => {
  const allDocs: ZapSignListDoc[] = [];
  
  // 1. Buscar a primeira página para obter o count total de documentos
  const url1 = `${ZAPSIGN_API}/docs/?page=1`;
  const res1 = await fetch(url1, {
    headers: {
      Authorization: `Bearer ${ZAPSIGN_TOKEN}`,
    },
  });

  if (!res1.ok) {
    const errText = await res1.text();
    throw new Error(`ZapSign API erro ${res1.status}: ${errText}`);
  }

  const data1: any = await res1.json();
  const results1: ZapSignListDoc[] = data1.results || [];
  allDocs.push(...results1);

  const count = data1.count || 0;
  const pageSize = 25;
  const totalPages = Math.ceil(count / pageSize);

  // 2. Buscar as últimas páginas (os documentos mais recentes na API crescente)
  // Buscamos as últimas 3 páginas (ex: se totalPages é 46, buscamos 46, 45 e 44)
  const pagesToFetch: number[] = [];
  for (let p = totalPages; p > 1; p--) {
    if (p >= totalPages - 2) {
      pagesToFetch.push(p);
    }
  }

  // Faz as requisições em paralelo para máxima velocidade
  const fetchPromises = pagesToFetch.map(async (p) => {
    try {
      const url = `${ZAPSIGN_API}/docs/?page=${p}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${ZAPSIGN_TOKEN}`,
        },
      });
      if (res.ok) {
        const data: any = await res.json();
        return data.results || [];
      }
    } catch (e) {
      console.error(`Erro ao buscar página ${p} do ZapSign:`, e);
    }
    return [];
  });

  const resultsLists = await Promise.all(fetchPromises);
  resultsLists.forEach((list) => {
    allDocs.push(...list);
  });

  return { docs: allDocs };
});
