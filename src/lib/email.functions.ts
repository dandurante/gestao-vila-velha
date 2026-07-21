import { createServerFn } from "@tanstack/react-start";
import {
  getRequestHeaders,
  getRequestIP,
  getRequestHost,
  getRequestProtocol,
} from "@tanstack/react-start/server";
import { supabase } from "@/integrations/supabase/client";
import nodemailer from "nodemailer";


const DEFAULT_WELCOME_TEXT = `BEM-VINDO(A)!

Recebemos sua manifestação de interesse na oportunidade de prestação de serviços autônomos disponibilizada pela DEX Invest Comércio e Varejo Ltda. e/ou Star Gold Serviços Operacionais Ltda.

A partir deste momento, você iniciará o processo de cadastro e análise documental para eventual habilitação em nosso sistema de oportunidades.

Importante: a candidatura realizada não garante contratação, convocação, aprovação, disponibilização de vagas ou prestação imediata de serviços.

O objetivo deste cadastro é verificar se você atende aos requisitos mínimos para integrar nosso banco de prestadores de serviços autônomos.

Durante o processo, poderão ser solicitados documentos pessoais, validações de identidade, informações cadastrais e demais documentos necessários ao cumprimento das exigências legais, operacionais e de segurança.

Caso seu cadastro seja aprovado, você receberá acesso à plataforma operacional, onde serão disponibilizadas oportunidades de prestação de serviços compatíveis com seu perfil.

As oportunidades serão disponibilizadas de acordo com critérios operacionais, demanda das unidades, região de atuação, disponibilidade de vagas e demais requisitos técnicos.

Você terá total liberdade para:

- aceitar ou recusar oportunidades de prestação de serviços;
- permanecer conectado ou desconectado da plataforma quando desejar;
- prestar serviços para outras empresas ou clientes;
- escolher os dias, horários e regiões de sua preferência, quando compatíveis com as oportunidades disponíveis.

O acesso à plataforma não gera garantia de disponibilização de oportunidades, remuneração mínima, exclusividade, jornada de trabalho ou qualquer vínculo empregatício, constituindo-se apenas em ferramenta tecnológica destinada à aproximação entre profissionais autônomos cadastrados e oportunidades de prestação de serviços eventualmente disponíveis.

Ao prosseguir com seu cadastro, você declara que leu e concorda com o Manual Corporativo de Governança para Prestadores de Serviços Autônomos, com o Contrato de Prestação de Serviços, com a Política de Privacidade, com o Código de Conduta, com a Política Antifraude e com os demais documentos institucionais disponibilizados pela CONTRATANTE.

Desejamos sucesso em seu processo de habilitação e agradecemos seu interesse em integrar nossa rede de prestadores de serviços.`;

// Setup email transporter
function getTransporter() {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "465");
  const smtpUser = process.env.SMTP_USER || "vagasdexfoods@gmail.com";
  const smtpPass = process.env.SMTP_PASS || "P@lvas79"; // User password provided

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    // Prevent certificate issues with local development/proxies
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Helper function to send email via Resend HTTP API (if configured) or fallback to Nodemailer SMTP
async function sendEmail({
  to,
  subject,
  html,
  text,
  confirmUrl,
  isDev,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  confirmUrl?: string;
  isDev?: boolean;
}) {
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    console.log(`[Email Server] Enviando e-mail para ${to} via API do Resend...`);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "Vagas Dex Foods <onboarding@resend.dev>";
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: html,
        text: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Email Server] Resend API error (${response.status}):`, errorText);
      throw new Error(`Resend API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Email Server] E-mail enviado com sucesso via Resend para ${to}. ID: ${data.id}`);
    return { success: true, messageId: data.id };
  } else {
    console.log(`[Email Server] Enviando e-mail para ${to} via SMTP...`);
    const transporter = getTransporter();
    const mailOptions = {
      from: `"Vagas Dex Foods" <vagasdexfoods@gmail.com>`,
      to: to,
      subject: subject,
      html: html,
      text: text,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email Server] E-mail enviado com sucesso via SMTP para ${to}. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (sendError: any) {
      console.error("[Email Server] Falha ao enviar e-mail via SMTP:", sendError.message);
      if (confirmUrl) {
        console.log("------------------ EMAIL BACKUP LOG ------------------");
        console.log(`Para: ${to}`);
        console.log(`Assunto: ${subject}`);
        console.log(`URL de Confirmação: ${confirmUrl}`);
        console.log("------------------------------------------------------");
      }
      
      if (isDev) {
        console.log("[Email Server] Simulando envio de e-mail com sucesso no console.");
        return { success: true, messageId: "simulated-id", simulated: true };
      }
      throw new Error(`Erro ao enviar e-mail por SMTP: ${sendError.message}`);
    }
  }
}

/**
 * Envia o e-mail de boas-vindas para o candidato com o botão de aceite.
 */
export const sendWelcomeEmailFn = createServerFn({ method: "POST" })
  .inputValidator((d: { freelancerId: string; email: string; nome: string }) => d)
  .handler(async ({ data: { freelancerId, email, nome } }) => {
    console.log(`[Email Server] Iniciando fluxo de e-mail de boas-vindas para ${nome} (${email})`);

    // 1. Obter o texto de boas-vindas do banco de dados (ou fallback)
    let welcomeText = DEFAULT_WELCOME_TEXT;
    try {
      const { data: settings, error } = await supabase
        .from("vagas_email_settings")
        .select("welcome_text")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[Email Server] Erro ao buscar texto de boas-vindas, usando padrão:", error.message);
      } else if (settings?.welcome_text) {
        welcomeText = settings.welcome_text;
      }
    } catch (e: any) {
      console.warn("[Email Server] Exceção ao buscar texto de boas-vindas, usando padrão:", e.message);
    }

    // 2. Registrar no banco que estamos enviando e gerar um consent ID único
    const { data: consentRecord, error: consentError } = await supabase
      .from("vagas_welcome_consent")
      .insert({
        freelancer_id: freelancerId,
        email: email,
        welcome_text: welcomeText,
      })
      .select()
      .single();

    if (consentError) {
      console.error("[Email Server] Erro ao criar registro de consentimento:", consentError);
      throw new Error(`Erro de banco de dados: ${consentError.message}`);
    }

    // 3. Resolver a URL base dinamicamente da requisição
    let baseUrl = "https://peopledex.lovable.app";
    try {
      const protocol = getRequestProtocol() || "https";
      const host = getRequestHost();
      if (host) {
        baseUrl = `${protocol}://${host}`;
      }
    } catch (err) {
      console.warn("[Email Server] Erro ao obter URL da requisição, usando padrão:", err);
    }

    const confirmUrl = `${baseUrl}/vagas-confirmacao?token=${consentRecord.id}`;
    
    // Links para os arquivos no servidor public
    const filesList = [
      "CÓDIGO DE CONDUTA.docx",
      "MANUAL CORPORATIVO DE GOVERNANÇA, COMPLIANCE, PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS.docx",
      "MANUAL OPERACIONAL DO PRESTADOR DE SERVIÇOS AUTÔNOMO – GERENTE.docx",
      "MANUAL OPERACIONAL DO PRESTADOR DE SERVIÇOS AUTÔNOMO – MOTOBOY.docx",
      "MANUAL OPERACIONAL DO PRESTADOR DE SERVIÇOS AUTÔNOMO – OPERADOR DE LOJA.docx",
      "POLÍTICA ANTIFRAUDE.docx",
      "POLÍTICA CORPORATIVA DE PRIVACIDADE E PROTEÇÃO DE DADOS PESSOAIS (LGPD).docx"
    ];

    const linksHtml = filesList
      .map(file => `          <li style="margin-bottom: 5px;"><a href="${encodeURI(`${baseUrl}/${file}`)}" target="_blank" style="text-decoration: underline; color: #2563eb;">${file}</a></li>`)
      .join("\n");

    // 4. Construir o corpo do e-mail
    const welcomeHtml = welcomeText.replace(/\n/g, "<br>");
    const mailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #059669; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-top: 0;">Bem-vindo(a) à Dex Foods!</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
          Olá, <strong>${nome}</strong>,<br><br>
          Ficamos felizes com o seu interesse em fazer parte do nosso time de parceiros. Leia com atenção as informações e termos de uso abaixo:
        </p>

        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; font-size: 13px; line-height: 1.6; color: #475569; max-height: 250px; overflow-y: auto; margin-bottom: 20px; font-family: monospace; white-space: pre-wrap;">
          ${welcomeHtml}
        </div>

        <p style="font-size: 14px; color: #334155; margin-bottom: 15px;">
          Para acessar os documentos institucionais adicionais, clique nos links abaixo:
        </p>
        <ul style="font-size: 13px; color: #2563eb; line-height: 1.6; padding-left: 20px; margin-bottom: 25px;">
${linksHtml}
        </ul>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" target="_blank" style="background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 24px; font-weight: bold; font-size: 14px; border-radius: 6px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
            Eu declaro que li e concordo com as informações aqui contidas
          </a>
        </div>

        <p style="font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px;">
          Esta mensagem foi enviada automaticamente pelo sistema Peopledex. Por favor, não responda a este e-mail.
        </p>
      </div>
    `;

    // 5. Enviar o e-mail via SMTP ou Resend
    try {
      const isDev = process.env.NODE_ENV === "development";
      const result = await sendEmail({
        to: email,
        subject: `Boas-vindas e Termos de Uso — Dex Foods`,
        html: mailHtml,
        confirmUrl,
        isDev,
      });
      return result;
    } catch (sendError: any) {
      throw new Error(sendError.message);
    }

  });

/**
 * Confirma o aceite dos termos e dispara e-mail de notificação para a administração.
 */
export const confirmConsentFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; ipAddress?: string }) => d)
  .handler(async ({ data: { token, ipAddress } }) => {
    console.log(`[Email Server] Processando confirmação para o token: ${token}`);

    // 1. Buscar o registro de consentimento
    const { data: consentRecord, error: consentError } = await supabase
      .from("vagas_welcome_consent")
      .select("*")
      .eq("id", token)
      .maybeSingle();

    if (consentError) {
      console.error("[Email Server] Erro ao buscar token de consentimento:", consentError);
      throw new Error(`Erro de banco: ${consentError.message}`);
    }

    if (!consentRecord) {
      console.error(`[Email Server] Token de consentimento não encontrado: ${token}`);
      throw new Error("Token de consentimento inválido ou não encontrado.");
    }

    // Se já foi aceito anteriormente, apenas retorna sucesso
    if (consentRecord.accepted_at) {
      console.log(`[Email Server] Consentimento já aceito anteriormente em: ${consentRecord.accepted_at}`);
      return { success: true, alreadyAccepted: true, email: consentRecord.email };
    }

    const acceptedAtStr = new Date().toISOString();

    let ip = ipAddress;
    try {
      const serverIp = getRequestIP();
      if (serverIp) {
        ip = serverIp;
      }
    } catch (err) {
      console.warn("[Email Server] Erro ao obter IP da requisição:", err);
    }

    // 2. Atualizar o aceite no banco de dados
    const { error: updateError } = await supabase
      .from("vagas_welcome_consent")
      .update({
        accepted_at: acceptedAtStr,
        ip_address: ip || null,
      })
      .eq("id", token);

    if (updateError) {
      console.error("[Email Server] Erro ao atualizar consentimento:", updateError);
      throw new Error(`Erro ao salvar aceite: ${updateError.message}`);
    }

    // 3. Buscar nome do freelancer no banco de dados
    let nomeCandidato = "Candidato Autônomo";
    try {
      if (consentRecord.freelancer_id) {
        const { data: registry } = await supabase
          .from("freelancer_registry")
          .select("nome")
          .eq("id", consentRecord.freelancer_id)
          .maybeSingle();

        if (registry?.nome) {
          nomeCandidato = registry.nome;
        }
      }
    } catch (err: any) {
      console.warn("[Email Server] Erro ao consultar nome do candidato:", err.message);
    }

    // Formatar data em padrão brasileiro
    const formattedDate = new Date(acceptedAtStr).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });

    const notifyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #059669; margin-top: 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Notificação de Aceite de Termos</h3>
        <p style="font-size: 14px; color: #334155; line-height: 1.5;">
          O candidato <strong>${nomeCandidato}</strong> (E-mail: <a href="mailto:${consentRecord.email}" style="color: #2563eb; text-decoration: none;">${consentRecord.email}</a>) aceitou os termos e a carta de boas-vindas.
        </p>
        <div style="background-color: #ffffff; padding: 12px 15px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px; margin: 15px 0;">
          <strong>Data e Hora do Aceite:</strong> ${formattedDate}<br>
          <strong>ID do Registro:</strong> ${consentRecord.id}<br>
          <strong>Endereço de IP:</strong> ${ipAddress || "Não informado"}
        </div>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 20px; text-align: center;">
          Peopledex Vagas — Notificações de Consentimento
        </p>
      </div>
    `;
    const notifyText = `O candidato ${nomeCandidato} (E-mail: ${consentRecord.email}) aceitou os termos e a carta de boas-vindas em ${formattedDate}.`;

    try {
      await sendEmail({
        to: "vagasdexfoods@gmail.com",
        subject: `Notificação de Aceite: ${nomeCandidato}`,
        html: notifyHtml,
        text: notifyText,
      });
      console.log(`[Email Server] E-mail de notificação enviado para administração.`);
    } catch (adminMailError: any) {
      console.error("[Email Server] Erro ao enviar e-mail de notificação para a administração:", adminMailError.message);
    }

    return { success: true, email: consentRecord.email, name: nomeCandidato };
  });

/**
 * Envia o e-mail de boas-vindas para vários candidatos em lote.
 */
export const sendBulkWelcomeEmailsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { freelancers: Array<{ id: string; email: string; nome: string }> }) => d)
  .handler(async ({ data: { freelancers } }) => {
    console.log(`[Email Server] Iniciando envio em lote de e-mails de boas-vindas para ${freelancers.length} prestadores`);
    
    // Obter texto de boas-vindas uma única vez para otimizar
    let welcomeText = DEFAULT_WELCOME_TEXT;
    try {
      const { data: settings } = await supabase
        .from("vagas_email_settings")
        .select("welcome_text")
        .limit(1)
        .maybeSingle();
      if (settings?.welcome_text) {
        welcomeText = settings.welcome_text;
      }
    } catch (e: any) {
      console.warn("[Email Server] Erro ao buscar texto de boas-vindas no lote:", e.message);
    }

    const results = [];
    const transporter = getTransporter();

    // Resolver a URL base uma única vez
    let baseUrl = "https://peopledex.lovable.app";
    try {
      const protocol = getRequestProtocol() || "https";
      const host = getRequestHost();
      if (host) {
        baseUrl = `${protocol}://${host}`;
      }
    } catch (err) {
      console.warn("[Email Server] Erro ao obter URL no lote:", err);
    }

    const isDev = process.env.NODE_ENV === "development" || !process.env.SMTP_PASS || process.env.SMTP_PASS === "P@lvas79;";

    for (const f of freelancers) {
      if (!f.email || !f.email.includes("@")) {
        results.push({ id: f.id, email: f.email || "", success: false, error: "E-mail inválido ou vazio" });
        continue;
      }

      try {
        // 1. Criar registro de consentimento
        const { data: consentRecord, error: consentError } = await supabase
          .from("vagas_welcome_consent")
          .insert({
            freelancer_id: f.id,
            email: f.email.trim().toLowerCase(),
            welcome_text: welcomeText,
          })
          .select()
          .single();

        if (consentError) {
          throw new Error(`Erro ao salvar no banco: ${consentError.message}`);
        }

        const confirmUrl = `${baseUrl}/vagas-confirmacao?token=${consentRecord.id}`;
        
        // Links para os arquivos no servidor public
        const filesList = [
          "CÓDIGO DE CONDUTA.docx",
          "MANUAL CORPORATIVO DE GOVERNANÇA, COMPLIANCE, PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS.docx",
          "MANUAL OPERACIONAL DO PRESTADOR DE SERVIÇOS AUTÔNOMO – GERENTE.docx",
          "MANUAL OPERACIONAL DO PRESTADOR DE SERVIÇOS AUTÔNOMO – MOTOBOY.docx",
          "MANUAL OPERACIONAL DO PRESTADOR DE SERVIÇOS AUTÔNOMO – OPERADOR DE LOJA.docx",
          "POLÍTICA ANTIFRAUDE.docx",
          "POLÍTICA CORPORATIVA DE PRIVACIDADE E PROTEÇÃO DE DADOS PESSOAIS (LGPD).docx"
        ];

        const linksHtml = filesList
          .map(file => `              <li style="margin-bottom: 5px;"><a href="${encodeURI(`${baseUrl}/${file}`)}" target="_blank" style="text-decoration: underline; color: #2563eb;">${file}</a></li>`)
          .join("\n");

        const welcomeHtml = welcomeText.replace(/\n/g, "<br>");
        const mailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #059669; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-top: 0;">Bem-vindo(a) à Dex Foods!</h2>
            
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
              Olá, <strong>${f.nome}</strong>,<br><br>
              Ficamos felizes com o seu interesse em fazer parte do nosso time de parceiros. Leia com atenção as informações e termos de uso abaixo:
            </p>

            <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; font-size: 13px; line-height: 1.6; color: #475569; max-height: 250px; overflow-y: auto; margin-bottom: 20px; font-family: monospace; white-space: pre-wrap;">
              ${welcomeHtml}
            </div>

            <p style="font-size: 14px; color: #334155; margin-bottom: 15px;">
              Para acessar os documentos institucionais adicionais, clique nos links abaixo:
            </p>
            <ul style="font-size: 13px; color: #2563eb; line-height: 1.6; padding-left: 20px; margin-bottom: 25px;">
${linksHtml}
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmUrl}" target="_blank" style="background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 24px; font-weight: bold; font-size: 14px; border-radius: 6px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                Eu declaro que li e concordo com as informações aqui contidas
              </a>
            </div>

            <p style="font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px;">
              Esta mensagem foi enviada automaticamente pelo sistema Peopledex. Por favor, não responda a este e-mail.
            </p>
          </div>
        `;

        const mailOptions = {
          from: `"Vagas Dex Foods" <vagasdexfoods@gmail.com>`,
          to: f.email,
          subject: `Boas-vindas e Termos de Uso — Dex Foods`,
          html: mailHtml,
        };

        if (isDev) {
          console.log(`[Email Server] Lote: Simulando envio para ${f.email}. URL: ${confirmUrl}`);
          results.push({ id: f.id, email: f.email, success: true, simulated: true });
        } else {
          const info = await sendEmail({
            to: f.email,
            subject: `Boas-vindas e Termos de Uso — Dex Foods`,
            html: mailHtml,
            confirmUrl,
          });
          results.push({ id: f.id, email: f.email, success: true, messageId: info.messageId });
        }
      } catch (err: any) {
        console.error(`[Email Server] Falha no envio em lote para ${f.email}:`, err.message);
        results.push({ id: f.id, email: f.email, success: false, error: err.message });
      }
    }

    return { results };
  });

/**
 * Reenvia o link de assinatura da ZapSign para um contrato ou recibo pendente.
 */
export const resendDocumentSignatureFn = createServerFn({ method: "POST" })
  .inputValidator((d: { type: "contract" | "receipt"; docToken: string; email: string; nome: string }) => d)
  .handler(async ({ data: { type, docToken, email, nome } }) => {
    console.log(`[Email Server] Reenviando ${type} (${docToken}) para ${nome} (${email})`);

    const zapToken = process.env.ZAPSIGN_TOKEN || "0b65b8cd-104c-45f8-b273-3baa8d14dd3da9b9d31b-e2fb-49f5-b0d6-88e56bbd528f";

    // 1. Obter informações do documento na ZapSign
    const { getZapSignDoc } = await import("./zapsign");
    const docData = await getZapSignDoc(zapToken, docToken);

    const signer = docData.signers?.[0];
    if (!signer || !signer.sign_url) {
      throw new Error("Link de assinatura não encontrado na ZapSign.");
    }

    const signUrl = signer.sign_url;
    const documentName = type === "contract" ? "Contrato de Prestação de Serviços" : "Recibo de Prestação de Serviços";

    const mailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #059669; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-top: 0;">Assinatura Pendente: ${documentName}</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
          Olá, <strong>${nome}</strong>,<br><br>
          Identificamos que o seu <strong>${documentName}</strong> está pendente de assinatura. Por favor, regularize sua documentação clicando no link abaixo para assinar digitalmente via ZapSign:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${signUrl}" target="_blank" style="background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 24px; font-weight: bold; font-size: 14px; border-radius: 6px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
            Clique aqui para assinar o documento
          </a>
        </div>

        <p style="font-size: 12px; color: #475569; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; word-break: break-all; margin-bottom: 25px;">
          Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:<br>
          <a href="${signUrl}" target="_blank" style="color: #2563eb;">${signUrl}</a>
        </p>

        <p style="font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px;">
          Esta mensagem foi enviada automaticamente pelo sistema Peopledex. Por favor, não responda a este e-mail.
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: email,
      subject: `Assinatura Pendente: ${documentName} — Dex Foods`,
      html: mailHtml,
    });

    return { success: true, messageId: result.messageId };
  });

