// src/components/TableRow.js
import React from "react";
import { Button, OverlayTrigger, Tooltip, ProgressBar } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faPause, faPlay, faTrash, faDownload } from "@fortawesome/free-solid-svg-icons";
import { downloadDataFromSupabase } from "../services/api";
import styles from "./TableRow.module.css";
import { toast } from "react-toastify";

const TableRow = ({
  row,
  handleFileUpload,
  handleGenerateToken,
  handlePause,
  handleResume,
  handleDeleteRow,
}) => {
  const handleDownload = async () => {
    const success = await downloadDataFromSupabase(row.lote);
    if (success) {
      toast.success("✅ Download realizado e dados deletados do Supabase!");
    } else {
      toast.error("❌ Erro ao realizar download ou deletar dados.");
    }
  };

  return (
    <tr>
      <td>
        {row.lote === "Sem arquivo" ? (
          <input
            type="file"
            accept=".csv,.txt"
            className="form-control"
            onChange={(event) => handleFileUpload(event, row.id)}
            disabled={row.processing}
          />
        ) : (
          row.lote
        )}
      </td>
      <td>
        {row.lote !== "Sem arquivo" && (
          <input type="text" className="form-control" value={row.lote} readOnly />
        )}
      </td>
      <td>
        <input type="text" className="form-control" value={row.total} readOnly />
      </td>
      <td>
        <input type="text" className="form-control" value={row.higienizados} readOnly />
      </td>
      <td>
        <input type="text" className="form-control" value={row.semRespostaAPI} readOnly />
      </td>
      <td>
        <ProgressBar
          now={parseFloat(row.porcentagem)}
          label={row.porcentagem}
          animated
          className={styles.customProgress}
        />
      </td>
      <td className="d-flex gap-2">
        {row.processing ? (
          <OverlayTrigger overlay={<Tooltip>Pausar Higienização</Tooltip>}>
            <Button
              variant="warning"
              size="sm"
              onClick={() => handlePause(row.id)}
            >
              <FontAwesomeIcon icon={faPause} />
            </Button>
          </OverlayTrigger>
        ) : (
          row.currentIndex > 0 && row.currentIndex < row.total ? (
            <OverlayTrigger overlay={<Tooltip>Retomar Higienização</Tooltip>}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleResume(row.id)}
              >
                <FontAwesomeIcon icon={faPlay} />
              </Button>
            </OverlayTrigger>
          ) : (
            <OverlayTrigger overlay={<Tooltip>Iniciar Higienização</Tooltip>}>
              <Button
                variant="success"
                size="sm"
                onClick={() => handleGenerateToken(row.id)}
                disabled={row.lote === "Sem arquivo"}
              >
                <FontAwesomeIcon icon={faUpload} />
              </Button>
            </OverlayTrigger>
          )
        )}
        
        <OverlayTrigger overlay={<Tooltip>Excluir Linha</Tooltip>}>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDeleteRow(row.id)}
            disabled={row.processing}
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        </OverlayTrigger>
        
        <OverlayTrigger overlay={<Tooltip>Baixar CSV</Tooltip>}>
          <Button
            variant="info"
            size="sm"
            onClick={handleDownload}
            disabled={row.processing || row.lote === "Sem arquivo"}
          >
            <FontAwesomeIcon icon={faDownload} />
          </Button>
        </OverlayTrigger>
      </td>
    </tr>
  );
};

export default TableRow;
