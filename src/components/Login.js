// src/components/Login.js
import React, { useState, useRef, useEffect } from "react";
import { Container, Row, Col, Form, Button, Card } from "react-bootstrap";
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
import axios from "axios";

function Login() {
  const [accessId, setAccessId] = useState("");
  const [password, setPassword] = useState("");
  const [tokenQuali, setTokenQuali] = useState("");
  const [tableData, setTableData] = useState([]);
  const timeoutsRef = useRef({});
  const processingRef = useRef({});

  // ---------------- NOVOS STATES PARA A FAIXA DE STATUS ----------------
  const [apiStatusColor, setApiStatusColor] = useState("#6c757d"); // Cinza padrão
  const [apiStatusText, setApiStatusText] = useState("Indefinido");
  const [apiInfo, setApiInfo] = useState({
    benefitNumber: "",
    documentNumber: "",
    name: "",
  });
  const [secondsLeft, setSecondsLeft] = useState(30);
  // ---------------------------------------------------------------------

  // Ref to store the latest tokenQuali
  const tokenQualiRef = useRef(tokenQuali);

  useEffect(() => {
    tokenQualiRef.current = tokenQuali;
  }, [tokenQuali]);

  // Função para renovar o token de forma independente (usada na faixa e também no processo)
  async function renewToken() {
    try {
      const credentialsRenew = {
        accessId: "jacqueline.vieira@qualiconsig.com.br",
        password: "Jacque@324",
        authKey: "",
        type: "",
        stayConnected: false,
      };
      const response = await axios.post(
        "https://api.ajin.io/v3/auth/sign-in",
        credentialsRenew,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      return response.data.token;
    } catch (error) {
      console.error("❌ Erro ao renovar token:", error.message);
      return null;
    }
  }

  // Função para checar o status da API
  async function checkApiStatus() {
    try {
      const newToken = await renewToken();
      if (!newToken) {
        setApiStatusColor("#6c757d"); // Cinza
        setApiStatusText("Indefinido");
        return;
      }

      const response = await axios.post(
        "https://api.ajin.io/v3/query-inss-balances/finder/await",
        {
          identity: "11846577500",
          benefitNumber: "6192428771",
          attempts: 3
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newToken}`,
          },
        }
      );

      if (response.status === 200) {
        if (response.data?.name?.trim()) {
          setApiStatusColor("#28a745"); // Verde
          setApiStatusText("API OK");
          setApiInfo({
            benefitNumber: response.data.benefitNumber || "",
            documentNumber: response.data.documentNumber || "",
            name: response.data.name || "",
          });
        } else {
          setApiStatusColor("#ffc107"); // Amarelo
          setApiStatusText("Instabilidade");
          setApiInfo({
            benefitNumber: response.data.benefitNumber || "",
            documentNumber: response.data.documentNumber || "",
            name: "",
          });
        }
      } else if (response.status === 400) {
        setApiStatusColor("#ffc107"); // Amarelo
        setApiStatusText("Instabilidade");
        setApiInfo({
          benefitNumber: "",
          documentNumber: "",
          name: "",
        });
      } else if (response.status >= 500) {
        setApiStatusColor("#dc3545"); // Vermelho
        setApiStatusText("API Fora do AR");
        setApiInfo({
          benefitNumber: "",
          documentNumber: "",
          name: "",
        });
      } else {
        setApiStatusColor("#6c757d"); // Cinza
        setApiStatusText("Indefinido");
        setApiInfo({
          benefitNumber: "",
          documentNumber: "",
          name: "",
        });
      }
    } catch (error) {
      if (error?.response?.status >= 500) {
        setApiStatusColor("#dc3545"); // Vermelho
        setApiStatusText("API Fora do AR");
      } else if (error?.response?.status === 400) {
        setApiStatusColor("#ffc107"); // Amarelo
        setApiStatusText("Instabilidade");
      } else {
        setApiStatusColor("#dc3545"); // Vermelho
        setApiStatusText("API Fora do AR");
      }
      setApiInfo({
        benefitNumber: "",
        documentNumber: "",
        name: "",
      });
    }
  }

  // Função para gerenciar o countdown e chamar checkApiStatus a cada 30 segundos
  useEffect(() => {
    checkApiStatus(); // initial check

    const statusInterval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev === 1) {
          checkApiStatus();
          return 30;
        } else {
          return prev - 1;
        }
      });
    }, 1000); // 1 second

    return () => clearInterval(statusInterval);
  }, []);

  // Função para gerenciar token refresh a cada 22 horas
  useEffect(() => {
    const tokenRefreshInterval = setInterval(async () => {
      const isProcessing = tableData.some(row => row.processing);
      if (isProcessing) {
        try {
          const newToken = await generateToken({
            accessId,
            password,
            authKey: "",
            type: "",
            stayConnected: false,
          });
          setTokenQuali(newToken);
          toast.info("🔄 Token atualizado automaticamente.");
        } catch (error) {
          toast.error("❌ Erro ao atualizar o token automaticamente.");
          console.error("Erro ao atualizar o token:", error.message);
        }
      }
    }, 22 * 60 * 60 * 1000); // 22 horas

    return () => clearInterval(tokenRefreshInterval);
  }, [accessId, password, tableData]);

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
        if (
          header.length !== 2 ||
          !(
            (header[0] === "cpf" && header[1] === "nb") ||
            (header[0] === "nb" && header[1] === "cpf")
          )
        ) {
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
      processFile(id);
    } catch (error) {
      toast.error("❌ Erro ao gerar o token!");
      console.error("Erro ao obter o token:", error.message);
    }
  }

  async function processFile(id) {
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
          const token = tokenQualiRef.current;
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
    processFile(id);
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
      <Row className="w-100">
        <Col md={3} className="p-3">
          {/* ----------------- FAIXA DE STATUS DA API ----------------- */}
          <div
            className="d-flex align-items-center mb-3 p-2"
            style={{
              width: "100%",
              background: "#f8f9fa",
              border: "1px solid #ddd",
              borderRadius: "5px",
              gap: "15px",
            }}
          >
            <div
              style={{
                width: "15px",
                height: "15px",
                borderRadius: "50%",
                backgroundColor: apiStatusColor,
              }}
            />
            <div>
              {/* <strong>Status da API:</strong> {apiStatusText} (Verificando {secondsLeft}s) */}
              <strong>Status da API:</strong> {apiStatusText}
            </div>
          </div>
          {/* -------------- FIM DA FAIXA DE STATUS DA API -------------- */}

          {/* ----------------- CARD DE LOGIN ----------------- */}
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
          {/* -------------- FIM DO CARD DE LOGIN -------------- */}
        </Col>

        <Col md={9} className="p-3 d-flex align-items-center justify-content-center">
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
        </Col>
      </Row>
    </Container>
  );
}

export default Login;
