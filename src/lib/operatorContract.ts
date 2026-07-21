import { jsPDF } from "jspdf";

export interface OperatorContractData {
  nome: string;
  cpf: string;
  rg: string;
  endereco: string;
  estadoCivil: string;
  unit: UnitKey;
  dailyRate: number;
}

export type UnitKey =
  | "Jabaquara"
  | "Campo Belo"
  | "V. Clementino"
  | "V. GOPOUVA"
  | "P. MANDAQUI"
  | "Aclimação"
  | "Pinheiros"
  | "GRU"
  | "J. Camburi"
  | "P. Canto"
  | "Serra"
  | "Boali";

interface UnitContract {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  representante: string;
}

export const OPERATOR_UNITS: Record<UnitKey, UnitContract> = {
  Jabaquara: {
    razaoSocial: "Dex Invest Comercio E Varejo LTDA",
    cnpj: "52.912.647/0002-74",
    endereco: "Avenida Doutor Luis Rocha Miranda, 164",
    bairro: "Jabaquara",
    municipio: "São Paulo",
    uf: "São Paulo",
    cep: "04344-010",
    representante: "DANIEL SILVA DE SOUSA",
  },
  "Campo Belo": {
    razaoSocial: "Dex Invest Comercio E Varejo LTDA",
    cnpj: "52.912.647/0003-55",
    endereco: "Rua Dr Jesuino Maciel, 1186",
    bairro: "Campo Belo",
    municipio: "São Paulo",
    uf: "São Paulo",
    cep: "04615-004",
    representante: "DANIEL SILVA DE SOUSA",
  },
  "V. Clementino": {
    razaoSocial: "Dex Invest Comercio E Varejo LTDA",
    cnpj: "52.912.647/0001-93",
    endereco: "Rua Loefgren, 1448",
    bairro: "Vila Clementino",
    municipio: "São Paulo",
    uf: "São Paulo",
    cep: "04040-001",
    representante: "DANIEL SILVA DE SOUSA",
  },
  "V. GOPOUVA": {
    razaoSocial: "Dex Invest Comercio E Varejo LTDA",
    cnpj: "52.912.647/0004-36",
    endereco: "Rua Cônego Valadao, 939",
    bairro: "Vila Gopoúva",
    municipio: "Guarulhos",
    uf: "São Paulo",
    cep: "07040-000",
    representante: "DANIEL SILVA DE SOUSA",
  },
  "P. MANDAQUI": {
    razaoSocial: "Dex Invest Comercio E Varejo LTDA",
    cnpj: "52.912.647/0005-17",
    endereco: "Avenida Santa Inês, 1048",
    bairro: "Parque Mandaqui",
    municipio: "São Paulo",
    uf: "São Paulo",
    cep: "02415-001",
    representante: "DANIEL SILVA DE SOUSA",
  },
  Aclimação: {
    razaoSocial: "Dex Invest Comercio E Varejo LTDA",
    cnpj: "52.912.647/0009-40",
    endereco: "Avenida da Aclimação, 101",
    bairro: "Aclimação",
    municipio: "São Paulo",
    uf: "São Paulo",
    cep: "01531-001",
    representante: "DANIEL SILVA DE SOUSA",
  },
  Pinheiros: {
    razaoSocial: "Dex Invest Comercio E Varejo LTDA",
    cnpj: "52.912.647/0008-60",
    endereco: "Rua Inácio Pereira da Rocha, 511",
    bairro: "Pinheiros",
    municipio: "São Paulo",
    uf: "São Paulo",
    cep: "05432-011",
    representante: "DANIEL SILVA DE SOUSA",
  },
  GRU: {
    razaoSocial: "Dex Invest Comercio E Varejo LTDA",
    cnpj: "52.912.647/0006-06",
    endereco: "Rodovia Hélio Smith, S/N",
    bairro: "-",
    municipio: "Guarulhos",
    uf: "São Paulo",
    cep: "07190-100",
    representante: "DANIEL SILVA DE SOUSA",
  },
  "J. Camburi": {
    razaoSocial: "JC ALIMENTOS LTDA.",
    cnpj: "57.440.222/0001-42",
    endereco: "Rua Gelu Vervloet Dos Santos, edifício Norte Sul Tower, Loja 01",
    bairro: "Jardim Camburi",
    municipio: "Vitória",
    uf: "Espírito Santo",
    cep: "29090-100",
    representante: "DANIEL SILVA DE SOUSA",
  },
  "P. Canto": {
    razaoSocial: "PC ALIMENTOS LTDA.",
    cnpj: "57.439.562/0001-53",
    endereco: "Avenida Rio Branco, 1777, lojas 04 e 05",
    bairro: "Praia do Canto",
    municipio: "Vitória",
    uf: "Espírito Santo",
    cep: "29055-642",
    representante: "DANIEL SILVA DE SOUSA",
  },
  Serra: {
    razaoSocial: "SR ALIMENTAÇÃO LTDA",
    cnpj: "57.438.869/0001-30",
    endereco: "Avenida Primeira Avenida, 60",
    bairro: "Parque Residencial Laranjeiras",
    municipio: "Serra",
    uf: "Espírito Santo",
    cep: "29165-155",
    representante: "DANIEL SILVA DE SOUSA",
  },
  Boali: {
    razaoSocial: "Ace Invest comércio e varejo Ltda.",
    cnpj: "45.226.103/0001-02",
    endereco: "Av. Doutor Olivio Lira, nº 353",
    bairro: "Praia da Costa",
    municipio: "Vila Velha",
    uf: "Espírito Santo",
    cep: "29050-632",
    representante: "DANIEL SILVA DE SOUSA",
  },
};

export const OPERATOR_UNIT_KEYS = Object.keys(OPERATOR_UNITS) as UnitKey[];

function formatDateBR(d: Date) {
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

function header(doc: jsPDF, pageW: number, loja: UnitContract) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(180, 140, 0);
  doc.text(loja.razaoSocial.toUpperCase(), pageW / 2, 12, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`CNPJ: ${loja.cnpj}`, pageW / 2, 17, { align: "center" });
  doc.setDrawColor(180, 140, 0);
  doc.setLineWidth(0.4);
  doc.line(15, 20, pageW - 15, 20);
  doc.setTextColor(0, 0, 0);
}
function footer(doc: jsPDF, pageW: number, pageH: number, pageNum: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Página ${pageNum}`, pageW / 2, pageH - 8, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

export function generateOperatorContractPdf(data: OperatorContractData): {
  blob: Blob;
  filename: string;
} {
  const loja = OPERATOR_UNITS[data.unit];
  if (!loja) throw new Error("Loja inválida.");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const maxW = pageW - marginX * 2;
  let y = 28;
  let pageNum = 1;

  const today = new Date();
  const endDate = new Date(today);
  endDate.setFullYear(endDate.getFullYear() + 1);

  header(doc, pageW, loja);

  const ensure = (n: number) => {
    if (y + n > pageH - 18) {
      footer(doc, pageW, pageH, pageNum);
      doc.addPage();
      pageNum++;
      header(doc, pageW, loja);
      y = 28;
    }
  };
  const title = (t: string) => {
    ensure(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(t, maxW);
    doc.text(lines, marginX, y);
    y += lines.length * 5 + 1;
  };
  const p = (t: string, opts: { bold?: boolean } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(t, maxW);
    ensure(lines.length * 5 + 2);
    doc.text(lines, marginX, y, { align: "justify", maxWidth: maxW });
    y += lines.length * 5 + 2;
  };

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const t = doc.splitTextToSize(
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS – APOIO OPERACIONAL FLEXÍVEL",
    maxW,
  );
  doc.text(t, pageW / 2, y, { align: "center" });
  y += t.length * 6 + 4;

  // Qualificação CONTRATANTE
  p(
    `${loja.razaoSocial.toUpperCase()}, pessoa jurídica de direito privado, devidamente inscrita sob CNPJ nº ${loja.cnpj}, com sede na ${loja.endereco}, Bairro ${loja.bairro}, Município de ${loja.municipio}, Estado de ${loja.uf}, CEP: ${loja.cep}, neste ato representada por seu sócio ${loja.representante}, brasileiro, casado, portador do CPF nº 094.981.707-46, doravante designada simplesmente CONTRATANTE;`,
  );

  // Qualificação CONTRATADA(O)
  const civil = (data.estadoCivil || "solteiro(a)").toLowerCase();
  p(
    `${data.nome.toUpperCase()}, brasileiro(a), ${civil}, profissional autônomo(a), devidamente inscrito(a) no CPF/MF sob o nº ${data.cpf}, portador(a) da cédula de identidade RG nº ${data.rg}, com endereço residencial na ${data.endereco}, doravante designado(a) simplesmente CONTRATADA(O).`,
  );

  p(
    'Todos acima qualificados, designam em conjunto como "PARTES" e individualmente como "CONTRATANTE" e "CONTRATADA(O)".',
  );
  p(
    "As PARTES celebram o presente CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS – APOIO OPERACIONAL FLEXÍVEL, sob a regência do Código Civil (Lei nº 10.406/02) e mediante as cláusulas e condições adiante estipuladas que, voluntariamente, aceitam e outorgam:",
  );

  // 1
  title("1. CLÁUSULA PRIMEIRA - DO OBJETO");
  p(
    "1.1. O presente contrato tem por objeto a prestação, pelo(a) CONTRATADO(A), de serviços autônomos, eventuais e de natureza acessória, consistentes no apoio operacional às atividades desenvolvidas pela CONTRATANTE, podendo abranger, de forma não exaustiva e conforme demanda pontual: organização e conferência de pedidos; suporte logístico interno relacionado ao fluxo de mercadorias; auxílio na preparação, separação e embalagem de produtos; apoio operacional pontual ao fluxo de atendimento e expedição.",
  );
  p(
    "1.2. As atividades ora contratadas possuem caráter meramente instrumental, complementar e não essencial, sendo executadas de forma desvinculada da estrutura organizacional da CONTRATANTE, não implicando, em qualquer hipótese, integração à sua atividade-fim, tampouco inserção funcional ou hierárquica.",
  );
  p(
    "1.3. A presente contratação é regida pelas disposições dos arts. 593 a 609 do Código Civil, que disciplinam a prestação de serviços de natureza civil, sendo firmada no âmbito da autonomia privada e da liberdade contratual, nos termos dos arts. 421 e 421-A do Código Civil, bem como dos princípios da livre iniciativa previstos no art. 170 da Constituição Federal.",
  );
  p(
    "1.4. As partes reconhecem que a execução das atividades descritas nesta cláusula não configura relação de emprego, por ausência dos requisitos previstos nos arts. 2º e 3º da Consolidação das Leis do Trabalho (CLT), especialmente no que se refere à subordinação jurídica, habitualidade, pessoalidade e controle de jornada, tratando-se de prestação de serviços de natureza estritamente civil.",
  );
  p(
    "1.5. A eventual atuação do(a) CONTRATADO(A) nas dependências da CONTRATANTE ocorrerá de forma pontual, não contínua e sem caráter de inserção estrutural, limitando-se à execução das demandas específicas ajustadas entre as partes, não caracterizando vínculo empregatício, nos termos da legislação vigente e da jurisprudência consolidada do Supremo Tribunal Federal acerca da licitude das relações contratuais entre agentes econômicos independentes.",
  );

  // 2
  title("2. CLÁUSULA SEGUNDA - DA NATUREZA AUTÔNOMA");
  p(
    "2.1. A relação jurídica estabelecida possui natureza estritamente civil, não sendo aplicáveis as normas da Consolidação das Leis do Trabalho.",
  );
  p(
    "2.2. O(a) CONTRATADO(A) atua por sua conta e risco, assumindo os encargos decorrentes de sua atividade, conforme arts. 593 e seguintes do Código Civil.",
  );
  p(
    "2.3. A contratação observa os princípios da liberdade econômica previstos na Lei nº 13.874/2019.",
  );
  p(
    "2.4. Fica acordado entre as partes que o(a) CONTRATADO(A) poderá prestar serviços para outros parceiros, concorrentes e afins, sem qualquer exclusividade.",
  );

  // 3 (Prazo preenchido)
  title("3. CLÁUSULA TERCEIRA – DO PRAZO");
  p(
    `3.1. A vigência deste Contrato se dá pelo prazo de 1 (um) ano, a contar do dia ${formatShort(today)} (“Data Inicial”), finalizando-se em ${formatShort(endDate)} (“Data Final”), podendo ser renovado entre Partes de comum acordo e mediante celebração de aditivo a este Contrato.`,
  );
  p(
    "3.2. Havendo interesse na rescisão antes do prazo acima estipulado, a parte interessada notificará a parte contrária, por escrito ou verbalmente, com antecedência mínima de 5 (cinco) dias.",
  );
  p(
    "3.3. A rescisão do presente instrumento de contrato não extingue os direitos e obrigações que as partes tenham entre si para com terceiros.",
  );

  // 4
  title("4. CLÁUSULA QUARTA - DA PRESTAÇÃO DO SERVIÇO");
  p(
    "4.1. O(a) CONTRATADO(A) prestará os serviços descritos na Cláusula Primeira em caráter autônomo, eventual e não exclusivo, podendo exercê-los em favor de terceiros, inclusive empresas do mesmo segmento econômico, em conformidade com os princípios da livre iniciativa e liberdade econômica, previstos no art. 170 da Constituição Federal e no art. 421-A do Código Civil.",
  );
  p(
    "4.2. A execução dos serviços ocorrerá sem qualquer forma de controle de jornada, imposição de horário ou exigência de comparecimento mínimo, cabendo exclusivamente ao(à) CONTRATADO(A) definir sua disponibilidade, organização e forma de atuação, nos termos dos arts. 593 a 609 do Código Civil, restando afastada a configuração de subordinação jurídica prevista no art. 3º da CLT.",
  );
  p(
    "4.3. As demandas de serviços poderão ser disponibilizadas pela CONTRATANTE de forma pontual e não obrigatória, competindo ao(à) CONTRATADO(A) a livre aceitação ou recusa, sem que tal decisão implique qualquer penalidade, ônus ou caracterização de habitualidade, preservando-se a autonomia da relação contratual.",
  );
  p(
    "4.4. Uma vez aceita determinada demanda, o(a) CONTRATADO(A) compromete-se a executá-la com zelo, diligência e observância das condições previamente ajustadas entre as partes, especialmente quanto ao local, prazo e especificações do serviço, nos termos do art. 422 do Código Civil.",
  );
  p(
    "4.5. A forma de prestação ora ajustada não implica, em qualquer hipótese, inserção do(a) CONTRATADO(A) na estrutura organizacional da CONTRATANTE, tampouco caracteriza relação de emprego, em razão da ausência dos requisitos previstos nos arts. 2º e 3º da CLT, especialmente subordinação, habitualidade e controle de jornada.",
  );

  // 5
  title("5. CLÁUSULA QUINTA – DA INDEPENDÊNCIA HIERÁRQUICA NA PRESTAÇÃO DE SERVIÇO");
  p(
    "5.1. Fica acordado entre a CONTRATANTE e o(a) CONTRATADO(A) que as partes NÃO POSSUEM HIERARQUIA NA RELAÇÃO DE PRESTAÇÃO DE SERVIÇO, logo, tendo em vista que a atividade profissional caracteriza-se como atividade meio, a CONTRATANTE informará as vagas disponíveis por meios de comunicação próprio ou por aplicativo e o(a) CONTRATADO(A) informará previamente se estará disponível para prestação de serviço.",
  );

  // 6
  title("6. CLÁUSULA SEXTA – DA PRESTAÇÃO DE SERVIÇOS DE NATUREZA EVENTUAL");
  p(
    "6.1. Fica estabelecido entre as partes que a prestação de serviços se caracterizará de natureza eventual, logo, a CONTRATANTE informará as vagas disponíveis por meios de comunicação própria (Aplicativo WhatsApp) ou por aplicativo e o(a) CONTRATADO(A) informará previamente se estará disponível para prestação de serviço, na data, hora e local indicado pela CONTRATANTE.",
  );

  // 7
  title("7. CLÁUSULA SÉTIMA – DO PAGAMENTO");
  p(
    "7.1. Pela execução dos serviços objeto do presente contrato, o(a) CONTRATADO(A) fará jus a remuneração ajustada entre as partes, a qual será devida exclusivamente em razão das demandas efetivamente executadas, podendo ser fixada por tarefa, diária ou unidade de serviço concluída, conforme previamente acordado entre as partes no momento da solicitação.",
  );
  p(
    "7.2. Fica expressamente estabelecido que a remuneração não possui natureza periódica, fixa ou garantida, inexistindo qualquer obrigação de pagamento mínimo ou continuidade, sendo certo que os valores serão devidos apenas quando houver a efetiva prestação dos serviços, em observância à lógica da contratação autônoma.",
  );
  p(
    `7.3. O valor da contraprestação será ajustado de comum acordo entre as partes, de acordo com a natureza, complexidade ou volume da atividade solicitada, ficando previamente estipulado o valor de ${data.dailyRate.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${data.dailyRate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} reais) por diária trabalhada, sem que tal ajuste implique alteração da natureza jurídica da presente relação.`,
  );
  p(
    "7.4. A remuneração ora pactuada possui natureza estritamente civil e indenizatória, não se caracterizando como salário ou verba trabalhista, nos termos dos arts. 593 a 609 do Código Civil, não se aplicando, portanto, as disposições previstas no art. 457 da CLT.",
  );
  p(
    "7.5. O pagamento será realizado mediante a emissão de recibo de pagamento a autônomo (RPA) ou outro documento fiscal cabível, observadas as disposições tributárias aplicáveis, especialmente quanto à responsabilidade do(a) CONTRATADO(A) pelo recolhimento de suas contribuições previdenciárias na condição de contribuinte individual, nos termos do art. 12, inciso V, alínea “h”, da Lei nº 8.212/1991.",
  );
  p(
    "7.6. A forma de remuneração ora ajustada não implica, em qualquer hipótese, reconhecimento de habitualidade, subordinação ou vínculo empregatício, permanecendo a presente relação regida pelo direito civil.",
  );

  // 8
  title("8. CLÁUSULA OITAVA – DA RESCISÃO");
  p(
    "8.1. O presente Contrato poderá ser terminado de forma unilateral mediante envio de notificação escrita à outra Parte com aviso prévio de 5 (cinco) dias, desde que liquidados todos os compromissos em relação a terceiros e de ambas as Partes até a data de envio da notificação.",
  );
  p(
    "8.2. Este Contrato poderá ser considerado rescindido, mediante simples notificação, a critério da Parte inocente, nos seguintes casos: (i) inadimplemento de quaisquer das obrigações contratuais não sanadas pela Parte inadimplente no prazo de 10 (dez) dias corridos, a contar do recebimento de aviso escrito, enviado pela Parte inocente; (ii) requerimento de falência, recuperação judicial ou pedido de homologação de recuperação extrajudicial ou distrato social de qualquer Parte, observado o disposto no artigo 117 da Lei nº 11.101/2005; ou (iii) ocorrência de caso fortuito ou de força maior, na forma do artigo 393 do Código Civil, regularmente comprovada e que perdurar por mais de 30 (trinta) dias.",
  );
  p(
    "8.3. Constituirá hipótese de inadimplemento contratual a execução dos serviços pelo(a) CONTRATADO(A) de forma negligente, imprudente ou em desacordo com as obrigações assumidas no presente instrumento, inclusive quando tal conduta resultar em prejuízos à CONTRATANTE ou a terceiros.",
  );
  p(
    "8.3.1. Para os fins desta cláusula, considera-se conduta inadequada aquela que evidencie falta de diligência na execução das atividades ajustadas, em desconformidade com os padrões mínimos de cuidado e zelo esperados, nos termos do art. 422 do Código Civil.",
  );
  p(
    "8.3.2. Verificada a ocorrência de inadimplemento, poderá a CONTRATANTE, a seu critério: I – notificar o(a) CONTRATADO(A) para regularização da conduta; II – suspender a disponibilização de novas demandas; III – rescindir o contrato, nos termos do art. 475 do Código Civil, sem prejuízo da apuração de perdas e danos.",
  );
  p(
    "8.3.3. O(a) CONTRATADO(A) responderá pelos danos causados em decorrência de sua conduta culposa ou dolosa, nos termos dos arts. 186 e 927 do Código Civil, obrigando-se à reparação integral dos prejuízos comprovadamente suportados.",
  );
  p("8.4. Praticar atos que atinjam a imagem comercial da CONTRATANTE perante terceiros.");
  p(
    "8.5. Deixar o(a) CONTRATADO(A) de cumprir qualquer das cláusulas dispostas no presente instrumento.",
  );
  p("8.6. Solicitar à CONTRATANTE atividade que exceda o previsto neste instrumento de contrato.");
  p("8.7. Deixar a CONTRATANTE de observar quaisquer obrigações que constem no presente contrato.");
  p("8.8. Deixar a CONTRATANTE de cumprir com o disposto na cláusula terceira deste contrato.");
  p(
    "8.9. Na hipótese de valores pendentes de recebimento, os valores devidos deverão ser quitados ao seu tempo correto, independentemente da manutenção ou não deste Contrato.",
  );

  // 9
  title("9. CLÁUSULA NONA – DA INEXISTÊNCIA DE SOCIEDADE");
  p(
    "9.1. O presente instrumento não cria vínculo societário entre as Partes, limitando o conjunto de seus esforços, na forma estabelecida, a um vínculo de parceria comercial para atingir a finalidade do objeto deste Contrato.",
  );

  // 10
  title("10. CLÁUSULA DÉCIMA – DA MULTA CONTRATUAL");
  p(
    "10.1. Em caso de rescisão motivada por infração contratual, ficam desobrigadas as partes de eventuais multas contratuais, bem como de prejuízo dos danos emergentes e lucros cessantes decorrentes do descumprimento das cláusulas especificadas no presente contrato.",
  );

  // 11
  title("11. CLÁUSULA DÉCIMA PRIMEIRA – DA AUSÊNCIA DE VÍNCULO TRABALHISTA");
  p(
    "11.1. Não se estabelece vínculo empregatício entre as Partes e os respectivos profissionais contratados por cada um. Cada Parte SERÁ ÚNICA E EXCLUSIVA RESPONSÁVEL por arcar com os encargos trabalhistas referentes aos seus empregados ou prepostos utilizados na execução deste Contrato, tais como, mas não se limitando a, pagamento de salários, indenizações por acidente de trabalho ou dispensa, aviso prévio, 13º salário, férias e encargos previdenciários, sociais e securitários.",
  );
  p(
    "11.2. Cada Parte será integral e exclusivamente responsável por toda e qualquer eventual reclamação trabalhista que vier a ser proposta por qualquer funcionário ou dos seus prepostos envolvidos na execução dos serviços objeto deste contrato, respondendo integralmente pelo pagamento de indenizações, multas, honorários advocatícios, custas processuais e demais encargos e isentando a outra Parte de qualquer débito ou responsabilidade.",
  );

  // 12
  title("12. CLÁUSULA DÉCIMA SEGUNDA – DAS DISPOSIÇÕES FINAIS");
  p(
    "12.1. Este Contrato é o único documento que regula os direitos e obrigações das PARTES com relação à Prestação dos Serviços, ficando expressamente cancelado e revogado todo e qualquer entendimento ou ajuste porventura existente, que não esteja aqui consignado.",
  );
  p(
    "12.2. Anticorrupção. Cada Parte declara neste ato que não violou, e se compromete de forma irrevogável a não violar, as disposições da lei anticorrupção brasileira (Lei 12.846/13), abstendo-se de qualquer oferta, pagamento, promessa ou autorização de pagamento a agente público com propósito de influenciar atos ou decisões oficiais, ou de obter ou reter negócios indevidamente.",
  );
  p(
    "12.3. O disposto neste Contrato somente poderá ser alterado por meio de aditivo contratual, escrito e devidamente assinado por ambas as Partes.",
  );
  p(
    "12.4. A tolerância de uma Parte para com a outra, relativamente ao descumprimento de qualquer das obrigações ora assumidas, não será considerada moratória, novação ou renúncia a qualquer direito.",
  );
  p(
    "12.5. Exime-se das penalidades dispostas neste Contrato a Parte submetida, comprovadamente, a caso fortuito ou força maior, tal como previsto no art. 393 do Código Civil.",
  );
  p(
    "12.6. Caso qualquer uma das cláusulas deste Contrato venha a ser declarada nula, no todo ou em parte, as demais cláusulas continuarão em vigor, a menos que o objeto deste Contrato seja afetado.",
  );
  p(
    "12.7. As Partes atribuem ao presente Contrato a natureza de título executivo extrajudicial, nos termos do art. 784, inciso III, do Código de Processo Civil.",
  );
  p(
    "12.8. O(a) CONTRATADO(A) reconhece e concorda que a CONTRATANTE: (i) não realiza processo seletivo; (ii) não promove treinamentos referentes à execução das atividades descritas no item 1; (iii) não exige disponibilidade nem periodicidade do(a) CONTRATADO(A); e (iv) não fiscaliza as suas atividades, seja pela própria Plataforma (WhatsApp) ou por qualquer outro meio.",
  );
  p(
    "12.9. O(a) CONTRATADO(A) reconhece que é independente e não exclusivo(a), atuando por conta própria, não havendo qualquer subordinação entre as partes, sendo livre para aceitar ou recusar a execução das atividades. A relação jurídica estabelecida não cria vínculo empregatício, societário, de associação, mandato, franquia ou de qualquer outra natureza.",
  );
  p(
    "12.10. O(a) CONTRATADO(A) cede em caráter universal, total, definitivo, por prazo indeterminado e a título gratuito à CONTRATANTE os direitos de uso de seu nome e imagem dentro da Plataforma (WhatsApp) da CONTRATANTE.",
  );
  p(
    "12.11. As partes convencionam que o presente contrato poderá ser assinado digitalmente, nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020.",
  );
  p(
    "12.12. A assinatura digital terá a mesma validade jurídica que a assinatura física, para todos os efeitos legais.",
  );

  // 13
  title("13. CLÁUSULA DÉCIMA TERCEIRA – FORO");
  p(
    `13.1. Fica eleito o Foro Central da Comarca da Capital de ${loja.uf} para dirimir as questões oriundas deste ajuste.`,
  );

  p(
    "E, assim, por estarem justas e contratadas, firmam o presente instrumento em duas vias de igual teor e forma, na presença de duas testemunhas.",
  );

  ensure(60);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${loja.municipio}, ${formatDateBR(today)}.`, marginX, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.text("Assinaturas:", marginX, y);
  y += 14;

  doc.setLineWidth(0.3);
  doc.line(marginX, y, marginX + 90, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(loja.razaoSocial.toUpperCase(), marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`(Representante Legal – ${loja.representante})`, marginX, y);
  y += 14;

  doc.setFontSize(10);
  doc.line(marginX, y, marginX + 90, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(`CONTRATADO(A) – ${data.nome.toUpperCase()}`, marginX, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`CPF: ${data.cpf}`, marginX, y);
  y += 14;

  ensure(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Testemunhas:", marginX, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.text("Nome completo: ___________________________________________", marginX, y);
  y += 6;
  doc.text("CPF: _______________________________________", marginX, y);
  y += 10;
  doc.text("Nome completo: ___________________________________________", marginX, y);
  y += 6;
  doc.text("CPF: _______________________________________", marginX, y);

  footer(doc, pageW, pageH, pageNum);

  const blob = doc.output("blob");
  const filename = `Contrato_Operador_${data.nome.replace(/\s+/g, "_")}_${data.unit.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;
  return { blob, filename };
}
