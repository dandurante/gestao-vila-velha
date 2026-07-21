import { jsPDF } from "jspdf";

interface ContractData {
  nome: string;
  cpf: string;
  rg: string;
  endereco: string;
  estadoCivil: string;
}

const HEADER = "STAR GOLD DELIVERY LTDA";
const SUBHEADER = "CNPJ: 61.011.091/0001-55";

function genderOf(estadoCivil: string): { nacionalidade: string; civil: string; portador: string } {
  // O cadastro não tem sexo; usamos o próprio "Solteiro(a)" como veio.
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

  const { nacionalidade, civil, portador } = genderOf(data.estadoCivil);
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
    "STAR GOLD DELIVERY LTDA, pessoa jurídica de direito privado, devidamente inscrita sob CNPJ nº 61.011.091/0001-55, com sede na Rua Loefgreen, nº 1448, Sala B, Bairro da Vila Clementina, Município de São Paulo, Estado de São Paulo, CEP: 04040-001, neste ato representada por seu sócio BRUNO GARCIA SANTANELLI, doravante designada simplesmente CONTRATANTE;",
  );

  // Qualificação CONTRATADA preenchida
  writeParagraph(
    `${data.nome.toUpperCase()}, ${nacionalidade}, ${civil}, profissional autônomo(a), devidamente inscrito(a) no CPF/MF sob o nº ${data.cpf}, ${portador} da cédula de identidade RG nº ${data.rg}, com endereço residencial na ${data.endereco}, doravante designado(a) simplesmente CONTRATADA(O).`,
  );

  writeParagraph(
    'Todos acima qualificados, designam em conjunto como "PARTES" e individualmente como "CONTRATANTE" e "CONTRATADA(O)".',
  );
  writeParagraph(
    "As PARTES celebram o presente contrato de PRESTAÇÃO DE SERVIÇOS DE MOTOBOY AUTÔNOMO OU MICRO EMPREENDEDOR INDIVIDUAL (MEI), sob a regência do Código Civil (Lei nº 10.406/02) e mediante as cláusulas e condições adiante estipuladas que, voluntariamente, aceitam e outorgam:",
  );

  // CLÁUSULA PRIMEIRA
  writeTitle("1. CLÁUSULA PRIMEIRA - DO OBJETO");
  writeParagraph(
    "1.1. O presente contrato de terceirização e prestação de serviços de transporte, coletas e entregas, conforme as cláusulas e condições a seguir estipuladas, as partes contratantes mutuamente aceitam e outorgam, para prestação de entrega de produtos através de empresa contratada de Microempreendedor Individual, com remuneração variável conforme volume de entregas.",
  );
  writeParagraph(
    "1.1.1. A relação estabelecida pelo presente contrato não se regerá pelas normas insculpidas na Consolidação das Leis do Trabalho, mas pelas constantes dos artigos 594 e seguintes do Novo Código Civil, sendo acordado entre as partes que a(o) CONTRATADA(O) não se caracteriza sob vínculo de subordinação para com a CONTRATANTE, sem obrigatoriedade de habitualidade, sem obrigatoriedade da CONTRATANTE em onerar os serviços recusados, podendo se fazer substituir com aviso antecipado à CONTRATANTE, podendo a(o) CONTRATADA(O) fixar seu próprio horário de trabalho.",
  );

  // CLÁUSULA SEGUNDA - DO PRAZO (preenchida)
  writeTitle("2. CLÁUSULA SEGUNDA – DO PRAZO");
  writeParagraph(
    `2.1. A vigência deste Contrato se dá pelo prazo de 1 (um) ano, a contar do dia ${formatShort(today)} ("Data Inicial"), finalizando-se em ${formatShort(endDate)} ("Data Final"), podendo ser renovado entre Partes de comum acordo e mediante celebração de aditivo a este Contrato.`,
  );
  writeParagraph(
    "2.2. Havendo interesse na rescisão antes do prazo acima estipulado, a parte interessada notificará a parte contrária, por escrito, com antecedência mínima de 5 (cinco) dias.",
  );
  writeParagraph(
    "2.3. A rescisão do presente instrumento de contrato não extingue os direitos e obrigações que as partes tenham entre si para com terceiros.",
  );

  // CLÁUSULA TERCEIRA
  writeTitle("3. CLÁUSULA TERCEIRA - DA PRESTAÇÃO DO SERVIÇO");
  writeParagraph(
    "3.1. A(O) CONTRATADA(O) prestará os serviços previstos na Cláusula Primeira, em caráter NÃO EXCLUSIVO, na cidade de São Paulo e região.",
  );
  writeParagraph(
    "3.2. Os serviços serão prestados sem horário fixo, de acordo com a conveniência da empresa e com a disponibilidade do contratado.",
  );
  writeParagraph(
    "3.3. A(O) CONTRATADA(O) deverá atender aos chamados ocasionais da CONTRATANTE, reservando-se ao direito de recusá-los na impossibilidade do atendimento imediato, em respeito aos serviços prestados a outras empresas.",
  );
  writeParagraph(
    "3.4. Uma vez aceito o serviço, a(o) CONTRATADA(O) se compromete a realizá-lo no tempo, local e seguindo as especificações combinadas.",
  );

  // CLÁUSULA QUARTA
  writeTitle("4. CLÁUSULA QUARTA – DA INDEPENDÊNCIA HIERÁRQUICA NA PRESTAÇÃO DE SERVIÇO");
  writeParagraph(
    "4.1. Fica acordado entre a CONTRATANTE e a(o) CONTRATADA(O), que as partes NÃO POSSUEM HIERARQUIA NA RELAÇÃO DE PRESTAÇÃO DE SERVIÇO, logo, tendo em vista que a atividade profissional caracteriza-se como atividade meio, a CONTRATANTE informará as vagas disponíveis por meios de comunicação próprio ou por aplicativo e a(o) CONTRATADA(O) informará previamente se estará disponível para prestação de serviço.",
  );

  // CLÁUSULA QUINTA
  writeTitle("5. CLÁUSULA QUINTA – DA PRESTAÇÃO DE SERVIÇOS DE NATUREZA EVENTUAL");
  writeParagraph(
    "5.1. Fica estabelecido entre as partes que a prestação de serviços se caracterizará de natureza eventual, logo, CONTRATANTE informará as vagas disponíveis por meios de comunicação própria (Aplicativo WhatsApp) ou por aplicativo e a(o) CONTRATADA(O) informará previamente se estará disponível para prestação de serviço, na data, hora e local indicado pela CONTRATANTE.",
  );

  // CLÁUSULA SEXTA
  writeTitle("6. CLÁUSULA SEXTA – DAS PERDAS E AVARIAS");
  writeParagraph(
    "6.1. As perdas ou avarias dos materiais durante o transporte serão de única e exclusiva responsabilidade da CONTRATADA e deverá ressarcir a CONTRATANTE de todos os prejuízos daí decorrentes.",
  );

  // CLÁUSULA SÉTIMA
  writeTitle(
    "7. CLÁUSULA SÉTIMA – DA TERCEIRIZAÇÃO CASO A(O) CONTRATADA(O) SEJA QUALIFICADA(O) COMO MEI",
  );
  writeParagraph(
    "7.1. A CONTRATADA na qualidade de empresa terceirizada e especializada no setor de transportes e cargas, compromete-se a prestar à CONTRATANTE serviços de transportes, coletas e entregas de peças, mercadorias, encomendas, documentos, volumes, pacotes e outros, dentro do perímetro urbano de São Paulo e arredores, sem limite de quilometragem, os quais serão executados através de um motorista equipado com veículo de carga automotor com capacidade de carga e locomoção que atenda às necessidades da CONTRATANTE, mediante remuneração pelo serviço através do pagamento do frete (art. 730 do Código Civil). A coleta no domicílio do embarcador ou a entrega no domicílio do destinatário deverão ser objeto de ajuste específico, declarado expressamente no conhecimento de transporte (art. 752 do Código Civil) mediante remuneração própria, valores estes pagos pelo consumidor e repassados à empresa MEI contratada.",
  );

  // CLÁUSULA OITAVA
  writeTitle("8. CLÁUSULA OITAVA – DO VEÍCULO");
  writeParagraph(
    "8.1. A fim de atender as solicitações da CONTRATANTE, a(o) CONTRATADA(O) colocará à disposição daquela um motorista equipado com um veículo automotor, durante todo o tempo de vigência do presente instrumento, que deverá estar disponível durante os horários contratados e nos locais indicados pela CONTRATANTE por meio de aplicativos de comunicação e afins, para realizar a entrega, podendo se fazer substituir por outras empresas de MEI ou pessoas indicadas.",
  );

  // CLÁUSULA NONA
  writeTitle("9. CLÁUSULA NONA – DOS CONDUTORES");
  writeParagraph(
    "9.1. Caso a CONTRATANTE, por qualquer motivo, não aprove os condutores enviados pela(o) CONTRATADA(O), ou os mesmos estejam impossibilitados para efetuar os serviços por motivos pessoais, de saúde e/ou quaisquer outros, a(o) CONTRATADA(O) deverá efetuar a imediata substituição dos mesmos, tantas e quantas vezes forem necessárias, até a completa satisfação e adaptação da CONTRATANTE, devendo os condutores de veículos enviados pela(o) CONTRATADA(O) ser sempre funcionários e/ou sócios integrantes desta, devidamente registrados e/ou constantes do contrato social.",
  );
  writeParagraph(
    "9.2. Ficarão a cargo exclusivo da(o) CONTRATADA(O) todos os custos com combustíveis, conservação, limpeza e manutenção do veículo, principalmente no que se refere à parte mecânica e requisitos e condições de segurança estabelecidos pelo Código de Trânsito Brasileiro e normas do CONTRAN, consequentemente sobre a possível indicação de empresa terceira ou pessoas indicadas em relação a sua indisponibilidade para prestação do serviço aceito pela(o) CONTRATADA(O).",
  );

  // CLÁUSULA DÉCIMA
  writeTitle("10. CLÁUSULA DÉCIMA – OBRIGAÇÕES");
  writeParagraph("10.1. Para a consecução do objeto previsto na Cláusula Primeira, caberá:");
  writeParagraph("10.1.1. À(AO) CONTRATADA(O):", { bold: true });
  writeParagraph(
    "10.1.1.1. Apresentação, no ato da assinatura do presente instrumento, certificado de MEI, comprovante de endereço, documentação de identificação, documentação do veículo que será utilizado para prestação de serviço e cópia da Carteira Nacional de Trânsito (CNH).",
  );
  writeParagraph(
    "10.1.1.2. Cumprir as normas e procedimentos de segurança definidos pela CONTRATANTE.",
  );
  writeParagraph(
    "10.1.1.3. Manter sigilo absoluto sobre as informações e documentos a que tiver acesso em razão da prestação do serviço.",
  );
  writeParagraph("10.1.1.4. Responder por danos causados a terceiros em razão de sua conduta.");
  writeParagraph("10.1.1.5. Manter regularizada toda a documentação pessoal e do veículo.");
  writeParagraph(
    "10.1.1.6. Cumprir os horários e prazos acordados para retirada e entrega das mercadorias.",
  );
  writeParagraph(
    "10.1.1.7. A(O) CONTRATADA(O) deverá possuir todos os equipamentos de segurança exigidos por força legal, responsabilizando-se única e exclusivamente por eventuais acidentes.",
  );
  writeParagraph(
    "10.1.1.8. A(O) CONTRATADA(O) deverá emitir as notas relativas à prestação do serviço, referente ao CNPJ cadastrado como MEI.",
  );
  writeParagraph(
    "10.1.1.9. A(O) CONTRATADA(O) deverá apresentar certidão de quitação de débitos do CNPJ cadastrado como MEI.",
  );
  writeParagraph(
    "10.1.1.10. A(O) CONTRATADA(O) deverá apresentar o CCM (Cadastro de Contribuinte Mobiliário).",
  );
  writeParagraph(
    "10.1.1.23. A(O) CONTRATADA(O) deverá assinar, ao final da prestação de serviço realizada para a CONTRATANTE, recibo informando a data do serviço prestado, horário e quantidade de entregas realizadas.",
  );
  writeParagraph("10.1.2. À CONTRATANTE:", { bold: true });
  writeParagraph(
    "10.1.2.1. Verificar a utilização do material necessário à execução dos serviços;",
  );
  writeParagraph(
    "10.1.2.2. Fornecer os dados tais como nome, endereço, telefone, entre outros, necessários ao contato com o cliente;",
  );
  writeParagraph("10.1.2.3. Efetuar o pagamento no prazo estipulado neste contrato.");

  // CLÁUSULAS 11-13
  writeTitle("11. CLÁUSULA DÉCIMA PRIMEIRA – DO PAGAMENTO");
  writeParagraph(
    "11.1. A CONTRATANTE pagará à(ao) CONTRATADA(O) o valor acordado por entrega/serviço, conforme tabela vigente.",
  );
  writeParagraph(
    "11.2.1. O pagamento previsto nesta cláusula será feito toda terça-feira subsequente à execução do serviço, mediante comprovação das entregas e relatórios, sob pena de incidência de multa de 2% (dois por cento) sobre o valor a ser pago.",
  );

  writeTitle("12. CLÁUSULA DÉCIMA SEGUNDA – DAS MERCADORIAS");
  writeParagraph(
    "12.1. As mercadorias deverão ser entregues com a mesma qualidade e quantidade que saíram da contratante, sob pena de desconto do valor dos produtos no frete.",
  );

  writeTitle("13. CLÁUSULA DÉCIMA TERCEIRA – DA RESCISÃO");
  writeParagraph(
    "13.3. Desídia do(a) contratado(a) no cumprimento das obrigações assumidas para com a CONTRATANTE e terceiros;",
  );
  writeParagraph(
    "13.4. Praticar atos que atinjam a imagem comercial da contratante perante terceiros;",
  );
  writeParagraph(
    "13.5. Deixar de cumprir a(o) CONTRATADA(O) qualquer das cláusulas dispostas no presente instrumento;",
  );
  writeParagraph(
    "13.6. Solicitar à CONTRATANTE atividade que exceda o previsto neste instrumento de contrato;",
  );
  writeParagraph(
    "13.7. Deixar a contratante de observar quaisquer obrigações que constem no presente contrato;",
  );

  // CLÁUSULA 17
  writeTitle("17. CLÁUSULA DÉCIMA SÉTIMA – DISPOSIÇÕES GERAIS");
  writeParagraph(
    "17.5. Exime-se das penalidades dispostas neste Contrato a Parte submetida, comprovadamente, a caso fortuito ou força maior, tal como previsto no Código Civil, desde que tal fato venha a afetar diretamente a execução do presente Contrato, conforme dispõe o artigo 393 do Código Civil Brasileiro.",
  );
  writeParagraph(
    "17.6. Caso qualquer uma das cláusulas deste Contrato venha a ser declarada nula, no todo ou em parte, por qualquer razão, as demais cláusulas continuarão em vigor, a menos que o objeto deste Contrato seja afetado.",
  );
  writeParagraph(
    "17.11. A(O) CONTRATADA(O) cede em caráter universal, total, definitivo, por prazo indeterminado e a título gratuito à CONTRATANTE os direitos de uso de seu nome e imagem dentro da Plataforma (WhatsApp) da CONTRATANTE para que os Clientes Finais ou Estabelecimentos Parceiros possam identificá-lo(a) e ainda em campanhas e eventos produzidos e/ou patrocinados pela CONTRATANTE dos quais a(o) CONTRATADA(O) participe.",
  );

  // Local e data + Assinaturas
  ensureSpace(50);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`São Paulo, ${formatDateBR(today)}.`, marginX, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.text("Assinaturas:", marginX, y);
  y += 14;

  // Linha CONTRATANTE
  doc.setLineWidth(0.3);
  doc.line(marginX, y, marginX + 90, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("STAR GOLD DELIVERY LTDA", marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("(Representante Legal – BRUNO GARCIA SANTANELLI)", marginX, y);
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
