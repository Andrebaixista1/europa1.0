// src/components/TableComponent.js
import React from "react";
import { Table } from "react-bootstrap";
import TableRow from "./TableRow";

const TableComponent = ({
  tableData,
  handleFileUpload,
  handleGenerateToken,
  handleCancel,
  handleDeleteRow,
}) => {
  return (
    <Table bordered striped responsive>
      <thead>
        <tr>
          <th>Selecionar</th>
          <th>Lote</th>
          <th>Total</th>
          <th>Higienizados</th>
          <th>Não Carregados</th>
          <th>% Carregado</th>
          <th>Ação</th>
        </tr>
      </thead>
      <tbody>
        {tableData.map((row) => (
          <TableRow
            key={row.id} // Use o id único como key
            row={row}
            handleFileUpload={handleFileUpload}
            handleGenerateToken={handleGenerateToken}
            handleCancel={handleCancel}
            handleDeleteRow={handleDeleteRow}
          />
        ))}
      </tbody>
    </Table>
  );
};

export default TableComponent;
