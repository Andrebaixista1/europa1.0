// src/services/api.js
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

// Configuração do Supabase
const SUPABASE_URL = "https://zxbwehohahcuexwutzqr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4YndlaG9oYWhjdWV4d3V0enFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1NzQ4ODIsImV4cCI6MjA1MzE1MDg4Mn0.yLKStnqwWW5-S5VKGXpOtQJz8m0fPaSjddDdqZ2UCCo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Função para remover acentuações em português
const removeAccents = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Função para remover acentuações de todas as strings em um objeto
const removeAccentsFromObject = (obj) => {
  const newObj = {};
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      newObj[key] = removeAccents(obj[key]);
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj;
};

// Função para formatar data de ddmmyyyy para yyyy-mm-dd
const formatDate = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return null;
  const day = dateStr.slice(0, 2);
  const month = dateStr.slice(2, 4);
  const year = dateStr.slice(4, 8);
  return `${year}-${month}-${day}`;
};

// Função para substituir pontos por vírgulas nas colunas especificadas
const replaceDecimalSeparator = (obj) => {
  const columns = [
    "limite_cartao_beneficio",
    "saldo_cartao_beneficio",
    "limite_cartao_consignado",
    "saldo_cartao_consignado",
    "saldo_credito_consignado",
    "saldo_total_maximo",
    "saldo_total_utilizado",
    "saldo_total_disponivel",
  ];
  const newObj = { ...obj };
  columns.forEach((col) => {
    if (newObj[col] !== null && newObj[col] !== undefined) {
      newObj[col] = newObj[col].toString().replace('.', ',');
    }
  });
  return newObj;
};

// Função para baixar dados filtrados do Supabase
export const downloadDataFromSupabase = async (fileName) => {
  try {
    const { data, error } = await supabase
      .from("inss_higienizado")
      .select("*")
      .eq("nome_arquivo", fileName);

    if (error) {
      console.error("❌ Erro ao buscar dados:", error.message);
      return false;
    }

    if (!data || data.length === 0) {
      console.warn("⚠️ Nenhum dado encontrado para esse arquivo.");
      return false;
    }

    // Remover acentuações de todas as strings nos dados
    const dataWithoutAccents = data.map(item => removeAccentsFromObject(item));

    // Substituir pontos por vírgulas nas colunas especificadas
    const dataWithCommas = dataWithoutAccents.map(item => replaceDecimalSeparator(item));

    // Converter para CSV separado por `;`
    const csv = Papa.unparse(dataWithCommas, {
      delimiter: ";",
      quotes: true,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log("✅ Download concluído.");
    return true;
  } catch (error) {
    console.error("❌ Erro inesperado ao baixar os dados:", error.message);
    return false;
  }
};

// Função para gerar token de autenticação
export const generateToken = async (credentials) => {
  try {
    const response = await axios.post("https://api.ajin.io/v3/auth/sign-in", credentials, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data.token;
  } catch (error) {
    console.error("❌ Erro ao gerar token:", error.message);
    throw error;
  }
};

// Função para consultar balanços INSS
export const queryInssBalances = async (cpf, nb, token) => {
  try {
    const response = await axios.post(
      "https://api.ajin.io/v3/query-inss-balances/finder/await",
      { identity: cpf, benefitNumber: nb, attempts: 3 },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response;
  } catch (error) {
    console.error("❌ Erro ao consultar INSS:", error.message);
    throw error;
  }
};

// Salvar dados na tabela inss_higienizado
export const saveToSupabase = async (dados, nomeArquivo) => {
  if (!dados) {
    console.error("⚠️ Nenhum dado disponível para salvar.");
    return;
  }

  try {
    const ip_origem = await getIpAddress();

    const payload = {
      numero_beneficio: dados.benefitNumber,
      numero_documento: dados.documentNumber,
      nome: dados.name,
      estado: dados.state || null,
      pensao: dados.alimony === "payer" ? "SIM" : "NÃO",
      data_nascimento: formatDate(dados.birthDate) || null,
      tipo_bloqueio: dados.blockType || null,
      data_concessao: dados.grantDate || null,
      tipo_credito: dados.creditType === "checking_account" ? "Conta Corrente" : "Cartão Magnético",
      limite_cartao_beneficio: dados.benefitCardLimit || null,
      saldo_cartao_beneficio: dados.benefitCardBalance || null,
      status_beneficio: dados.benefitStatus || null,
      data_fim_beneficio: dados.benefitEndDate || null,
      limite_cartao_consignado: dados.consignedCardLimit || null,
      saldo_cartao_consignado: dados.consignedCardBalance || null,
      saldo_credito_consignado: dados.consignedCreditBalance || null,
      saldo_total_maximo: dados.maxTotalBalance || null,
      saldo_total_utilizado: dados.usedTotalBalance || null,
      saldo_total_disponivel: dados.availableTotalBalance || null,
      data_consulta: dados.queryDate || null,
      data_retorno_consulta: dados.queryReturnDate || null,
      tempo_retorno_consulta: dados.queryReturnTime || null,
      nome_representante_legal: dados.legalRepresentativeName || null,
      banco_desembolso: dados.disbursementBankAccount?.bank || null,
      agencia_desembolso: dados.disbursementBankAccount?.branch || null,
      numero_conta_desembolso: dados.disbursementBankAccount?.number || null,
      digito_conta_desembolso: dados.disbursementBankAccount?.digit || null,
      numero_portabilidades: dados.numberOfPortabilities || null,
      ip_origem: ip_origem,
      nome_arquivo: nomeArquivo,
    };

    console.log("Payload a ser salvo no Supabase:", payload);

    const { error } = await supabase.from("inss_higienizado").insert([payload]);

    if (error) {
      console.error(`❌ Erro ao salvar no Supabase:`, error.message);
    } else {
      console.log(`✅ Dados salvos na tabela inss_higienizado com sucesso!`);
    }
  } catch (err) {
    console.error("❌ Erro inesperado ao salvar no Supabase:", err.message);
  }
};

// Função para obter IP da máquina
const getIpAddress = async () => {
  try {
    const response = await axios.get("https://api64.ipify.org?format=json");
    return response.data.ip;
  } catch (error) {
    console.error("❌ Erro ao obter IP:", error.message);
    return "Desconhecido";
  }
};

// Função para deletar `nome_arquivo` do Supabase
export const deleteArquivoFromSupabase = async (fileName) => {
  try {
    const { error } = await supabase
      .from("inss_higienizado")
      .delete()
      .eq("nome_arquivo", fileName);

    if (error) {
      console.error("❌ Erro ao deletar arquivo:", error.message);
      throw error;
    }

    console.log("✅ Arquivo deletado com sucesso do Supabase.");
  } catch (error) {
    console.error("❌ Erro inesperado ao deletar arquivo:", error.message);
    throw error;
  }
};
