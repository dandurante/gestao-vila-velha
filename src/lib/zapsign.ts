import { supabase } from "@/integrations/supabase/client";

const ZAPSIGN_API = "https://api.zapsign.com.br/api/v1";

export interface ZapSignSigner {
  token: string;
  sign_url: string;
  status: string;
  name: string;
}

export interface ZapSignDocResult {
  token: string;
  name: string;
  signers: ZapSignSigner[];
  status?: string;
  signed_file?: string;
  original_file?: string;
}

/** Converte um Blob PDF para string base64 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}



/**
 * Envia um PDF para a ZapSign via Ponte SQL (RPC) para evitar CORS.
 */
export async function sendToZapSign(
  apiKey: string,
  pdfBlob: Blob,
  docName: string,
  signerEmail: string,
  signerName: string
): Promise<ZapSignDocResult> {
  const base64 = await blobToBase64(pdfBlob);

  const payload = {
    name: docName,
    base64_pdf: base64,
    signers: [
      {
        name: signerName.trim(),
        email: signerEmail.trim(),
        send_automatic_email: true,
      },
    ],
  };

  console.log("Enviando para ZapSign via Supabase RPC com Payload:", payload);

  // Usamos RPC para contornar bloqueios de CORS do navegador
  const { data, error } = await supabase.rpc("send_to_zapsign", {
    api_key: apiKey,
    payload: payload,
  });

  console.log("Resposta bruta do banco:", data);

  if (error) {
    console.error("Erro RPC ZapSign:", error);
    throw new Error("Falha na ponte do banco de dados. Verifique se a extensão HTTP está activa.");
  }

  const r = data as any;

  // Se o ZapSign devolveu um erro no JSON
  if (r && (r.error || r.detail || r.message)) {
    const errorMsg = r.error || r.detail || r.message || "Erro desconhecido na ZapSign";
    throw new Error(`ZapSign diz: ${JSON.stringify(errorMsg)}`);
  }

  if (!r || (!r.token && !r.signers)) {
    throw new Error(`Resposta inesperada da ZapSign: ${JSON.stringify(r)}`);
  }

  return r as ZapSignDocResult;
}

/**
 * Consulta o status atual de um documento na ZapSign via RPC.
 */
export async function getZapSignDoc(apiKey: string, docToken: string): Promise<ZapSignDocResult> {
  const { data, error } = await supabase.rpc("get_zapsign_doc", {
    api_key: apiKey,
    doc_token: docToken,
  });

  if (error) {
    console.error("Erro RPC ZapSign (get):", error);
    throw new Error("Falha ao consultar status na ZapSign.");
  }

  const r = data as any;
  if (r && (r.error || r.detail) && !r.token) {
    throw new Error(`ZapSign diz: ${JSON.stringify(r.error || r.detail)}`);
  }

  return r as ZapSignDocResult;
}
