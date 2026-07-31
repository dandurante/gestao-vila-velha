import { jsPDF } from "jspdf";

interface ContractData {
  nome: string;
  cpf: string;
  rg: string;
  endereco: string;
  estadoCivil: string;
}

const HEADER = "AJAX SERVIÇOS DE ENTREGA LTDA.";
const SUBHEADER = "CNPJ: 52.311.860/0001-40";

function genderOf(estadoCivil: string): { nacionalidade: string; civil: string; portador: string } {
  const civil = estadoCivil || "solteiro(a)";
  return {
    nacionalidade: "brasileiro(a)",
    civil: civil.toLowerCase(),
    portador: "portador(a)",
  };
}

function addPageHeader(doc: jsPDF, pageW: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(180, 140, 0);
  doc.text(HEADER, pageW / 2, 12, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(SUBHEADER, pageW / 2, 17, { align: "center" });
  doc.setDrawColor(180, 140, 0);
  doc.setLineWidth(0.4);
  doc.line(15, 20, pageW - 15, 20);
  doc.setTextColor(0, 0, 0);
}

function addPageFooter(doc: jsPDF, pageW: number, pageH: number, pageNum: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Página ${pageNum}`, pageW / 2, pageH - 8, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

function formatDateBR(d: Date): string {
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatShort(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

export function generateContractPdf(data: ContractData): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const maxW = pageW - marginX * 2;
  let y = 28;
  let pageNum = 1;

  const { nacionalidade, civil } = genderOf(data.estadoCivil);
  const today = new Date();
  const endDate = new Date(today);
  endDate.setFullYear(endDate.getFullYear() + 1);

  addPageHeader(doc, pageW);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 18) {
      addPageFooter(doc, pageW, pageH, pageNum);
      doc.addPage();
      pageNum++;
      addPageHeader(doc, pageW);
      y = 28;
    }
  };

  const writeTitle = (text: string) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(text, marginX, y);
    y += 6;
  };

  const writeParagraph = (text: string, opts: { bold?: boolean; size?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    const lines = doc.splitTextToSize(text, maxW);
    ensureSpace(lines.length * 5 + 2);
    doc.text(lines, marginX, y, { align: "justify", maxWidth: maxW });
    y += lines.length * 5 + 2;
  };

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const titleLines = doc.splitTextToSize(
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MOTOBOY AUTÔNOMO OU MICRO EMPREENDEDOR INDIVIDUAL (MEI)",
    maxW,
  );
  doc.text(titleLines, pageW / 2, y, { align: "center" });
  y += titleLines.length * 6 + 4;

  // Qualificação CONTRATANTE
  writeParagraph(
    "CONTRATANTE: AJAX SERVIÇOS DE ENTREGA LTDA., pessoa jurídica de direito privado, devidamente inscrita sob CNPJ nº 52.311.860/0001-40, com sede na Rua General Osório, nº 127, Edif. A Gazeta, sala 902, Centro, Vitória/ES, CEP: 29010-030, neste ato representada por seu sócio DANIEL BARROS DURANTE.",
    { bold: true }
  );

  // Qualificação CONTRATADO(A)
  writeParagraph(
    `CONTRATADO(A): ${data.nome.toUpperCase()}, ${nacionalidade}, ${civil}, prestador(a) autônomo(a) / MEI, inscrito(a) no CPF sob o nº ${data.cpf}, portador(a) da Cédula de Identidade RG nº ${data.rg}, residente e domiciliado(a) na ${data.endereco}.`
  );

  // 1
  writeTitle("1. CLÁUSULA PRIMEIRA – DO OBJETO");
  writeParagraph(
    "1.1. O presente contrato de terceirização e prestação de serviços de transporte, coletas e entregas tem como objeto a entrega de produtos através de prestação autônoma ou Microempreendedor Individual, com remuneração variável conforme o volume de entregas.",
  );
  writeParagraph(
    "1.1.1. A relação estabelecida por este instrumento rege-se pelos artigos 594 e seguintes do Código Civil (Lei nº 10.406/02), sem vínculo de subordinação ou habitualidade, podendo o(a) CONTRATADO(A) recusar serviços, se fazer substituir mediante aviso prévio e fixar seus próprios horários.",
  );

  // 2
  writeTitle("2. CLÁUSULA SEGUNDA – DO PRAZO");
  writeParagraph(
    `2.1. A vigência deste Contrato dá-se pelo prazo de 1 (um) ano a contar da data de sua assinatura (${formatShort(today)}), finalizando-se em (${formatShort(endDate)}), podendo ser renovado mediante aditivo.`,
  );
  writeParagraph(
    "2.2. Havendo interesse na rescisão antecipada, a parte interessada notificará a outra por escrito com antecedência mínima de 5 (cinco) dias.",
  );

  // 3
  writeTitle("3. CLÁUSULA TERCEIRA – DA PRESTAÇÃO DO SERVIÇO");
  writeParagraph(
    "3.1. O(A) CONTRATADO(A) prestará os serviços em caráter NÃO EXCLUSIVO na cidade de São Paulo e região.",
  );
  writeParagraph(
    "3.2. Os serviços serão prestados sem horário fixo, conforme a conveniência da operação e a livre disponibilidade do contratado.",
  );
  writeParagraph(
    "3.3. O(A) CONTRATADO(A) poderá recusar chamados ocasionais quando estiver impossibilitado ou prestando serviços a terceiros.",
  );
  writeParagraph(
    "3.4. Uma vez aceito o serviço, compromete-se a realizá-lo conforme o local e especificações combinadas.",
  );

  // 4
  writeTitle("4. CLÁUSULA QUARTA – DA INDEPENDÊNCIA HIERÁRQUICA");
  writeParagraph(
    "4.1. As partes declaram que não possuem hierarquia. A CONTRATANTE informará as vagas disponíveis e o(a) CONTRATADO(A) responderá sobre sua disponibilidade prévia.",
  );

  // 5
  writeTitle("5. CLÁUSULA QUINTA – DA NATUREZA EVENTUAL");
  writeParagraph(
    "5.1. A prestação de serviços possui natureza eventual, disponibilizada via aplicativo de mensagens (WhatsApp) ou plataforma própria.",
  );

  // 6
  writeTitle("6. CLÁUSULA SEXTA – DAS PERDAS E AVARIAS");
  writeParagraph(
    "6.1. As perdas ou avarias dos materiais durante o transporte serão de exclusiva responsabilidade do(a) CONTRATADO(A), devendo ressarcir a CONTRATANTE dos prejuízos comprovados.",
  );

  // 7
  writeTitle("7. CLÁUSULA SÉTIMA – DA TERCEIRIZAÇÃO (MEI)");
  writeParagraph(
    "7.1. Na qualidade de MEI ou prestador autônomo especializado em entregas urbanas, o frete será remunerado conforme os valores e tabelas repassados.",
  );

  // 8
  writeTitle("8. CLÁUSULA OITAVA – DO VEÍCULO");
  writeParagraph(
    "8.1. O(A) CONTRATADO(A) utilizará veículo automotor próprio (motocicleta), em adequadas condições de uso e segurança, assumindo os custos de combustível, manutenção e conservação.",
  );

  // 9
  writeTitle("9. CLÁUSULA NONA – DOS CONDUTORES");
  writeParagraph(
    "9.1. Todos os custos com combustível, manutenção, peças, conservação do veículo e multas de trânsito correm por conta exclusiva do(a) CONTRATADO(A).",
  );

  // 10
  writeTitle("10. CLÁUSULA DÉCIMA – DAS OBRIGAÇÕES");
  writeParagraph("10.1. Obrigações do(a) CONTRATADO(A):", { bold: true });
  writeParagraph(
    "• Apresentar documento com foto (RG/CNH), CPF, comprovante de endereço e documento da motocicleta.",
  );
  writeParagraph(
    "• Manter equipamentos de proteção de segurança exigidos pelo Código de Trânsito Brasileiro.",
  );
  writeParagraph(
    "• A entrega do pedido deve ser realizada no prazo hábil médio estipulado de 45 (quarenta e cinco) minutos após a retirada.",
  );
  writeParagraph("• Garantir a integridade física dos produtos transportados.");
  writeParagraph(
    "• Responder civil e administrativamente por multas de trânsito causadas no exercício da atividade.",
  );
  writeParagraph(
    "• Realizar a assinatura eletrônica dos relatórios e recibos semanais de produção.",
  );
  writeParagraph("10.2. Obrigações da CONTRATANTE:", { bold: true });
  writeParagraph(
    "• Fornecer os dados de endereço e contato do destinatário para a efetivação da entrega.",
  );
  writeParagraph("• Efetuar o pagamento da remuneração nas datas pactuadas.");

  // 11
  writeTitle("11. CLÁUSULA DÉCIMA PRIMEIRA – DO PAGAMENTO");
  writeParagraph(
    "11.1. A remuneração será variável conforme o volume de entregas e diárias acordadas.",
  );
  writeParagraph(
    "11.2. A remuneração padrão pelo dia de serviço prestado inclui a diária base de R$ 100,00. Neste valor está incluída as horas de trabalho, o aluguel da moto, e o combustível necessario para a realização do trabalho. Será fornecida refeição no local.",
  );
  writeParagraph(
    "11.3. O pagamento é efetuado semanalmente (às terças-feiras subsequentes à prestação do serviço), via Pix ou transferência bancária, mediante conferência e assinatura do recibo de pagamento.",
  );

  // 12
  writeTitle("12. CLÁUSULA DÉCIMA SEGUNDA – DAS MERCADORIAS");
  writeParagraph(
    "12.1. O prestador responderá pelo valor das notas e mercadorias em caso de extravio indevido ou avaria por negligência, eximindo-se em casos de força maior ou caso fortuito devidamente justificados.",
  );

  // 13
  writeTitle("13. CLÁUSULA DÉCIMA TERCEIRA – DA RESCISÃO");
  writeParagraph(
    "13.1. O contrato poderá ser rescindido por qualquer das partes mediante comunicação prévia por escrito de 5 (cinco) dias, ou imediatamente em caso de infração grave a qualquer das cláusulas.",
  );

  // 14
  writeTitle("14. CLÁUSULA DÉCIMA QUARTA – DA INEXISTÊNCIA DE SOCIEDADE");
  writeParagraph(
    "14.1. O instrumento não estabelece vínculo societário, representação comercial ou associação entre as partes.",
  );

  // 15
  writeTitle("15. CLÁUSULA DÉCIMA QUINTA – DA AUSÊNCIA DE VÍNCULO TRABALHISTA");
  writeParagraph(
    "15.1. O presente contrato não gera vínculo empregatício de qualquer natureza (CLT), sendo o(a) CONTRATADO(A) autônomo(a) e responsável por seus próprios encargos previdenciários e tributários.",
  );

  // 16
  writeTitle("16. CLÁUSULA DÉCIMA SEXTA – DAS ASSINATURAS ELETRÔNICAS");
  writeParagraph(
    "16.1. As partes aceitam a assinatura e formalização deste instrumento por meio eletrônico / digital (ZapSign / ICP-Brasil), nos termos da MP nº 2.200-2/2001 e Lei nº 14.063/2020.",
  );

  // 17
  writeTitle("17. CLÁUSULA DÉCIMA SÉTIMA – DO FORO");
  writeParagraph(
    "17.1. Fica eleito o Foro Central da Comarca da Capital do Estado de São Paulo para dirimir quaisquer dúvidas ou controvérsias decorrentes deste contrato.",
  );

  // Local e data + Assinaturas
  ensureSpace(50);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Vitória/ES, ${formatDateBR(today)}.`, marginX, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.text("Assinaturas:", marginX, y);
  y += 14;

  // Linha CONTRATANTE
  doc.setLineWidth(0.3);
  doc.line(marginX, y, marginX + 90, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("AJAX SERVIÇOS DE ENTREGA LTDA.", marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("(Representante Legal – DANIEL BARROS DURANTE)", marginX, y);
  y += 14;

  // Linha CONTRATADA
  doc.setFontSize(10);
  doc.line(marginX, y, marginX + 90, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(`CONTRATADO(A) – ${data.nome.toUpperCase()}`, marginX, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`CPF: ${data.cpf}`, marginX, y);

  addPageFooter(doc, pageW, pageH, pageNum);

  const blob = doc.output("blob");
  const filename = `Contrato_${data.nome.replace(/\s+/g, "_")}.pdf`;
  return { blob, filename };
}
