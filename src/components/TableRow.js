// src/components/TableRow.js
import React from "react";
import { Button, OverlayTrigger, Tooltip, ProgressBar } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faTimes, faTrash, faDownload } from "@fortawesome/free-solid-svg-icons";
import { downloadDataFromSupabase } from "../services/api";
import styles from "./TableRow.module.css";

const TableRow = ({
  row,
  handleFileUpload,
  handleGenerateToken,
  handleCancel,
  handleDeleteRow,
}) => {
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
        <input type="text" className="form-control" value={row.naoHigienizados} readOnly />
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
        <OverlayTrigger overlay={<Tooltip>Iniciar Higienização</Tooltip>}>
          <Button
            variant="success"
            size="sm"
            onClick={() => handleGenerateToken(row.id)}
            disabled={row.lote === "Sem arquivo" || row.processing}
          >
            <FontAwesomeIcon icon={faUpload} />
          </Button>
        </OverlayTrigger>
        <OverlayTrigger overlay={<Tooltip>Cancelar Higienização</Tooltip>}>
          <Button
            variant="warning"
            size="sm"
            onClick={() => handleCancel(row.id)}
            disabled={!row.processing}
          >
            <FontAwesomeIcon icon={faTimes} />
          </Button>
        </OverlayTrigger>
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
            onClick={() => downloadDataFromSupabase(row.lote)}
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
