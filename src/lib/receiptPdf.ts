import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { numeroParaExtenso } from "@/lib/extenso";
import { formatBRLCurrency } from "@/lib/currency";
import { UNIT_DETAILS, type Unit } from "@/lib/units";

export interface ReceiptFreelancerInfo {
  nome: string;
  cpf: string;
  rg?: string;
  role?: string;
}

export interface ReceiptRow {
  name: string;
  pix: string;
  unit: string;
  entry_date: string;
  daily_rate: number | string;
  deliveries_total?: number | string | null;
}

export interface GeneratedReceipt {
  blob: Blob;
  filename: string;
  amount: number;
  referencePeriod: string;
  workedDates: string[];
}

/**
 * Gera o PDF do recibo para um prestador em uma loja num período.
 * Lança Error se faltar dados corporativos ou não houver lançamentos.
 */
export function generateReceiptPdf(params: {
  freelancer: ReceiptFreelancerInfo;
  unit: string;
  periodRows: ReceiptRow[];
  startDate: Date;
  endDate: Date;
}): GeneratedReceipt {
  const { freelancer, unit, periodRows, startDate, endDate } = params;

  const baseCompany = UNIT_DETAILS[unit as Unit];
  if (!baseCompany) {
    throw new Error(`Dados corporativos da loja ${unit} não encontrados.`);
  }

  if (periodRows.length === 0) {
    throw new Error(`Nenhum lançamento encontrado para a loja ${unit} neste período.`);
  }

  const isEntregador = freelancer.role === "Entregador";
  const company = isEntregador
    ? {
        ...baseCompany,
        razaoSocial: "Star Gold Delivery Ltda.",
        cnpj: "61.011.091/0001-55",
      }
    : baseCompany;

  const total = periodRows.reduce(
    (acc, r) => acc + Number(r.daily_rate) + Number(r.deliveries_total || 0),
    0,
  );
  const uniqueDates = Array.from(new Set(periodRows.map((r) => r.entry_date))).sort();
  const dateList = uniqueDates
    .map((iso, idx) => {
      const parts = iso.split("-");
      if (parts.length < 3) return `${idx + 1}. ${iso}`;
      const [y, m, d] = parts;
      return `${idx + 1}. ${d}/${m}/${y}`;
    })
    .join("\n");

  const valorFormatado = formatBRLCurrency(total);
  const valorPorExtenso = numeroParaExtenso(total);
  const valorCompleto = `${valorFormatado} (${valorPorExtenso})`;
  const today = new Date();
  const formattedToday = format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const local = company.state === "SP" ? "São Paulo" : "Espírito Santo";

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  if (isEntregador) {
    const servicoDesc = "serviços terceirizados de delivery";
    const empresaCompleta = `${company.razaoSocial}, inscrita no CNPJ nº ${company.cnpj}`;
    const canalDivulgacao = "no aplicativo Whatsapp, por indicação, ou sistema Pick In Go";

    const text = `Eu, ${freelancer.nome}, devidamente inscrito sob CPF/MF nº ${freelancer.cpf}, informo que, realizei a prestação de serviço nas datas:\n\n${dateList}\n\nPela empresa ${empresaCompleta}, para prestar ${servicoDesc}, não restando nenhum pagamento pendente, totalizando o montante de ${valorCompleto}. Afirmo que, me candidatei a vaga de forma voluntária na qual detenho ciência que a empresa ${company.razaoSocial} (CNPJ ${company.cnpj}) disponibiliza semanalmente/diariamente ${canalDivulgacao}, a quantidade de vagas e os endereços para prestação de serviço, efetua o pagamento diariamente ou semanalmente de acordo com as datas e serviços realizados no período de minha prestação de serviço.\n\n${local}, ${formattedToday}.`;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE PAGAMENTO", pageWidth / 2, 30, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.text(`Loja: ${unit}`, pageWidth / 2, 40, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${company.razaoSocial}`, pageWidth / 2, 46, { align: "center" });
    doc.text(`CNPJ: ${company.cnpj}`, pageWidth / 2, 51, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const splitText = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(splitText, 20, 65);

    const textHeight = splitText.length * 7;
    const footerY = 65 + textHeight + 20;

    doc.line(pageWidth / 2 - 50, footerY + 30, pageWidth / 2 + 50, footerY + 30);
    doc.text("Assinatura", pageWidth / 2, footerY + 35, { align: "center" });
    doc.setFontSize(10);
    doc.text(freelancer.nome, pageWidth / 2, footerY + 40, { align: "center" });
    doc.text(`CPF: ${freelancer.cpf}`, pageWidth / 2, footerY + 45, { align: "center" });
  } else {
    const rgText = freelancer.rg || "________________";
    const text = `Eu, ${freelancer.nome}, portador da cédula de identidade RG nº ${rgText} e devidamente inscrito sob CPF/MF nº ${freelancer.cpf}, informo que, realizei a prestação de serviço nas datas:\n\n${dateList}\n\nPela empresa ${company.razaoSocial}, inscrita no CNPJ nº ${company.cnpj}, com sede na ${company.endereco}, CEP ${company.cep}, para prestação de serviços na função de Operadora de Loja (Freelancer), consistindo no apoio operacional às atividades da unidade comercial, mediante contratação eventual e autônoma, sem exclusividade, subordinação jurídica ou vínculo empregatício de qualquer natureza, não restando qualquer pagamento pendente, totalizando o montante de ${valorCompleto}.\n\nAfirmo que, me candidatei a vaga de forma voluntária na qual detenho ciência que a empresa ${company.razaoSocial} disponibiliza semanalmente/diariamente no aplicativo (Whatsapp – Grupo vagas Dex), por indicação, ou sistema Pick In Go, a quantidade de vagas e os endereços para prestação de serviço, efetua o pagamento diariamente ou semanalmente de acordo com as datas e serviços realizados no período de minha prestação de serviço.\n\nDeclaro expressamente que a presente prestação de serviços ocorreu de forma eventual, autônoma e sem exclusividade, inexistindo relação de emprego, subordinação jurídica, controle de jornada, habitualidade ou pessoalidade, nos termos dos artigos 2º e 3º da Consolidação das Leis do Trabalho – CLT, conferindo plena, geral, irrevogável e irretratável quitação pelos serviços ora prestados e pelos valores recebidos.\n\n${local}, ${formattedToday}.`;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE PRESTAÇÃO DE SERVIÇO", pageWidth / 2, 25, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const splitText = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(splitText, 20, 38);

    const textHeight = splitText.length * 5.5;
    const footerY = 38 + textHeight + 15;

    doc.line(pageWidth / 2 - 50, footerY + 20, pageWidth / 2 + 50, footerY + 20);
    doc.setFontSize(10);
    doc.text("Assinatura", pageWidth / 2, footerY + 25, { align: "center" });
  }

  const startISO = format(startDate, "yyyy-MM-dd");
  const endISO = format(endDate, "yyyy-MM-dd");
  const safeName = freelancer.nome.replace(/\s+/g, "_");
  const safeUnit = unit.replace(/[^a-zA-Z0-9]+/g, "_");
  const filename = `Recibo_${safeName}_${safeUnit}_${startISO}_a_${endISO}.pdf`;

  return {
    blob: doc.output("blob"),
    filename,
    amount: total,
    referencePeriod: `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`,
    workedDates: uniqueDates,
  };
}
