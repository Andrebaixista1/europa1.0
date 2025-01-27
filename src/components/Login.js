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
} from "../services/api";

function Login() {
  const [accessId, setAccessId] = useState("");
  const [password, setPassword] = useState("");
  const [tokenQuali, setTokenQuali] = useState("");
  const [tableData, setTableData] = useState([]);
  const timeoutsRef = useRef({});
  const processingRef = useRef({});

  const handleAddRow = () => {
    const newRow = {
      id: uuidv4(),
      lote: "Sem arquivo",
      total: 0,
      higienizados: 0,
      naoHigienizados: 0,
      porcentagem: "0.00%",
      fileContent: "",
      processing: false,
    };
    setTableData([...tableData, newRow]);
  };

  const handleFileUpload = async (event, id) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = async (e) => {
        const lines = e.target.result.split("\n").filter((line) => line.trim() !== "");
        const totalLines = lines.length;
        const loteNome = formatFileName(file.name);

        const updatedTable = tableData.map((row) =>
          row.id === id
            ? {
                ...row,
                lote: loteNome,
                total: totalLines,
                naoHigienizados: 0,
                porcentagem: "0.00%",
                fileContent: lines,
              }
            : row
        );
        setTableData(updatedTable);
        toast.info(`📂 Arquivo ${file.name} carregado com ${totalLines} linhas!`);
      };
    }
  };

  async function handleGenerateToken(id) {
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
    let naoHigienizados = row.naoHigienizados;
    let processed = row.higienizados + row.naoHigienizados;
  
    async function processLine(i) {
      if (!processingRef.current[id]) {
        toast.dismiss(`higienizacao-${id}`);
        setTableData((prevData) =>
          prevData.map((row) =>
            row.id === id ? { ...row, processing: false } : row
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
            row.id === id ? { ...row, processing: false } : row
          )
        );
        return;
      }
  
      const columns = lines[i].split(";");
      const cpf = columns[0]?.trim();
      const nb = columns[1]?.trim();

      if (!cpf || cpf.length !== 11 || !nb || nb.length < 10) {
        naoHigienizados++;
      } else {
        try {
          const response = await queryInssBalances(cpf, nb, token);

          if (response.status === 200) {
            higienizados++;
            await saveToSupabase(response.data, row.lote);
          } else {
            naoHigienizados++;
          }
        } catch (error) {
          naoHigienizados++;
        }
      }

  
      processed++;
      const porcentagem = ((processed / row.total) * 100).toFixed(2) + "%";
  
      setTableData((prevData) =>
        prevData.map((r) =>
          r.id === id
            ? {
                ...r,
                higienizados,
                naoHigienizados,
                porcentagem,
              }
            : r
        )
      );
  
      timeoutsRef.current[id] = setTimeout(() => processLine(i + 1), 1000);
    }
  
    processLine(0);
  }
  

  const handleCancel = (id) => {
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
    toast.warning("⏹️ Processamento cancelado!");
  };

  const handleDeleteRow = (id) => {
    handleCancel(id);
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

            <Button className="mt-4 w-100" variant="primary" onClick={handleAddRow}>
              + Adicionar
            </Button>
          </Form>
        </Card>
      </div>

      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center overflow-auto">
        {tableData.length > 0 && (
          <TableComponent
            tableData={tableData}
            handleFileUpload={handleFileUpload}
            handleGenerateToken={handleGenerateToken}
            handleCancel={handleCancel}
            handleDeleteRow={handleDeleteRow}
          />
        )}
      </div>
    </Container>
  );
}

export default Login;
