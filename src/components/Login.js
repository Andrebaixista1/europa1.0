// src/components/Login.js
import React, { useState, useRef } from "react";
import { Container, Form, Button, Card } from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify"; 
import "react-toastify/dist/ReactToastify.css";
import TableComponent from "./TableComponent";
import { formatFileName } from "../utils/formatFileName";
import { v4 as uuidv4 } from "uuid";
import {
  generateToken,
  saveToSupabase,
  queryInssBalances,
  deleteArquivoFromSupabase,
} from "../services/api";

function Login() {
  const [accessId, setAccessId] = useState("");
  const [password, setPassword] = useState("");
  const [tokenQuali, setTokenQuali] = useState("");
  const [tableData, setTableData] = useState([]);
  const timeoutsRef = useRef({});
  const processingRef = useRef({});

  const handleAddRow = () => {
    if (tableData.length >= 10) {
      toast.error("❌ Limite de 10 linhas atingido.");
      return;
    }
    const newRow = {
      id: uuidv4(),
      lote: "Sem arquivo",
      total: 0,
      higienizados: 0,
      semRespostaAPI: 0,
      porcentagem: "0.00%",
      fileContent: [],
      processing: false,
      currentIndex: 0,
    };
    setTableData([...tableData, newRow]);
  };

  const handleFileUpload = async (event, id) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = async (e) => {
        const allLines = e.target.result.split("\n").filter((line) => line.trim() !== "");
        if (allLines.length < 2) {
          toast.error("❌ Arquivo deve conter pelo menos duas linhas (cabeçalho e dados).");
          return;
        }
        const header = allLines[0].split(";").map(col => col.trim().toLowerCase());
        if (header.length !== 2 || 
            !((header[0] === "cpf" && header[1] === "nb") || 
              (header[0] === "nb" && header[1] === "cpf"))) {
          toast.error("❌ O cabeçalho deve conter apenas duas colunas: 'cpf' e 'nb' em qualquer ordem.");
          return;
        }
        const cpfIndex = header[0] === "cpf" ? 0 : 1;
        const nbIndex = header[1] === "nb" ? 1 : 0;
        const dataLines = allLines.slice(1).map(line => {
          const cols = line.split(";").map(col => col.trim());
          return {
            cpf: cols[cpfIndex] || "",
            nb: cols[nbIndex] || "",
          };
        });
        const totalLines = dataLines.length;
        const loteNome = formatFileName(file.name);

        const updatedTable = tableData.map((row) =>
          row.id === id
            ? {
                ...row,
                lote: loteNome,
                total: totalLines,
                semRespostaAPI: 0,
                porcentagem: "0.00%",
                fileContent: dataLines,
                currentIndex: 0,
              }
            : row
        );
        setTableData(updatedTable);
        toast.info(`📂 Arquivo ${file.name} carregado com ${totalLines} linhas!`);
      };
    }
  };

  async function handleGenerateToken(id) {
    if (!accessId || !password) {
      toast.error("❌ Por favor, insira o Login (Email) e a Senha.");
      return;
    }

    const credentials = {
      accessId,
      password,
      authKey: "",
      type: "",
      stayConnected: false,
    };
    try {
      const token = await generateToken(credentials);
      setTokenQuali(token);
      toast.dismiss();
      toast.info("🔄 Iniciando Higienização...", {
        autoClose: true,
        toastId: `higienizacao-${id}`,
      });
      processingRef.current[id] = true;
      setTableData((prevData) =>
        prevData.map((row) =>
          row.id === id ? { ...row, processing: true } : row
        )
      );
      processFile(id, token);
    } catch (error) {
      toast.error("❌ Erro ao gerar o token!");
      console.error("Erro ao obter o token:", error.message);
    }
  }

  async function processFile(id, token) {
    const row = tableData.find((row) => row.id === id);
    if (!row) {
      toast.dismiss(`higienizacao-${id}`);
      toast.error("❌ Linha não encontrada!");
      return;
    }

    const lines = row.fileContent;
    let higienizados = row.higienizados;
    let semRespostaAPI = row.semRespostaAPI;
    let processed = higienizados + semRespostaAPI;
    let currentIndex = row.currentIndex;

    async function processLine(i) {
      if (!processingRef.current[id]) {
        toast.dismiss(`higienizacao-${id}`);
        setTableData((prevData) =>
          prevData.map((row) =>
            row.id === id ? { ...row, processing: false, currentIndex } : row
          )
        );
        return;
      }

      if (i >= lines.length || !lines[i]) {
        toast.dismiss(`higienizacao-${id}`);
        toast.success("✅ Processamento concluído!");
        processingRef.current[id] = false;
        setTableData((prevData) =>
          prevData.map((row) =>
            row.id === id ? { ...row, processing: false, currentIndex: i } : row
          )
        );
        return;
      }

      const { cpf, nb } = lines[i];

      if (!cpf || cpf.length !== 11 || !nb || nb.length < 10) {
        semRespostaAPI++;
        console.log(`Linha ${i + 2} inválida: CPF ou NB inválidos.`);
      } else {
        try {
          const response = await queryInssBalances(cpf, nb, token);

          console.log(`Resposta da API para CPF: ${cpf}, NB: ${nb}:`, response.data);

          if (response.status === 200) {
            const dados = response.data;
            const hasName = dados.name && dados.name.trim() !== "";

            if (hasName) {
              higienizados++;
              console.log("Dados válidos para salvar:", dados);
              await saveToSupabase(dados, row.lote);
            } else {
              semRespostaAPI++;
              console.log(`Linha ${i + 2} inválida: Resposta da API faltando 'name'.`);
            }
          } else {
            semRespostaAPI++;
            console.log(`Linha ${i + 2} inválida: Status da API não é 200.`);
          }
        } catch (error) {
          semRespostaAPI++;
          console.error(`Erro ao consultar INSS para CPF: ${cpf}, NB: ${nb}:`, error.message);
        }
      }

      processed++;
      currentIndex = i + 1;

      const porcentagem = ((processed / row.total) * 100).toFixed(2) + "%";

      setTableData((prevData) =>
        prevData.map((r) =>
          r.id === id
            ? {
                ...r,
                higienizados,
                semRespostaAPI,
                porcentagem,
                currentIndex,
              }
            : r
        )
      );

      timeoutsRef.current[id] = setTimeout(() => processLine(currentIndex), 1000);
    }

    processLine(currentIndex);
  }

  const handlePause = (id) => {
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }
    processingRef.current[id] = false;
    setTableData((prevData) =>
      prevData.map((row) =>
        row.id === id ? { ...row, processing: false } : row
      )
    );
    toast.warning("⏸️ Processamento pausado!");
  };

  const handleResume = (id) => {
    const row = tableData.find((row) => row.id === id);
    if (!row) return;

    if (processingRef.current[id]) {
      toast.info("🔄 Já está processando.");
      return;
    }

    if (row.currentIndex >= row.total) {
      toast.info("✅ Já concluiu o processamento.");
      return;
    }

    toast.info("🔄 Retomando Higienização...", {
      autoClose: true,
      toastId: `higienizacao-${id}`,
    });
    processingRef.current[id] = true;
    setTableData((prevData) =>
      prevData.map((r) =>
        r.id === id ? { ...r, processing: true } : r
      )
    );
    processFile(id, tokenQuali);
  };

  const handleDeleteRow = async (id) => {
    const row = tableData.find((row) => row.id === id);
    if (row && row.lote !== "Sem arquivo") {
      try {
        await deleteArquivoFromSupabase(row.lote);
        toast.success("🗑️ Arquivo excluído do banco de dados!");
      } catch (error) {
        toast.error("❌ Erro ao excluir arquivo do banco de dados!");
        console.error("Erro ao excluir do Supabase:", error.message);
      }
    }
    handlePause(id);
    setTableData((prevData) => prevData.filter((row) => row.id !== id));
    toast.error("🗑️ Linha removida!");
  };

  return (
    <Container fluid className="d-flex vh-100">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="w-25 p-3">
        <Card className="p-4 shadow">
          <h2 className="text-center mb-4">Login Qualibanking</h2>
          <Form>
            <Form.Group>
              <Form.Label>Login (Email)</Form.Label>
              <Form.Control
                type="email"
                placeholder="Digite seu email"
                value={accessId}
                onChange={(e) => setAccessId(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Senha</Form.Label>
              <Form.Control
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Form.Group>

            <Button
              className="mt-4 w-100"
              variant="primary"
              onClick={handleAddRow}
              disabled={tableData.length >= 10}
            >
              + Adicionar
            </Button>
            {tableData.length >= 10 && (
              <Form.Text className="text-danger">
                Limite de 10 linhas atingido.
              </Form.Text>
            )}
          </Form>
        </Card>
      </div>

      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center overflow-auto">
        {tableData.length > 0 && (
          <TableComponent
            tableData={tableData}
            handleFileUpload={handleFileUpload}
            handleGenerateToken={handleGenerateToken}
            handlePause={handlePause}
            handleResume={handleResume}
            handleDeleteRow={handleDeleteRow}
          />
        )}
      </div>
    </Container>
  );
}

export default Login;
