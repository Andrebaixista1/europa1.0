// src/components/TableComponent.js
import React, { useState } from "react";
import { Table, Pagination } from "react-bootstrap";
import TableRow from "./TableRow";
import './TableComponent.css';

const TableComponent = ({
  tableData,
  handleFileUpload,
  handleGenerateToken,
  handlePause,
  handleResume,
  handleDeleteRow,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const sortedData = React.useMemo(() => {
    let sortableData = [...tableData];
    if (sortConfig.key !== null) {
      sortableData.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (!isNaN(aValue) && !isNaN(bValue)) {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableData;
  }, [tableData, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const totalLote = new Set(tableData.map(row => row.lote)).size;
  const totalTotal = tableData.reduce((acc, row) => acc + row.total, 0);
  const totalHigienizados = tableData.reduce((acc, row) => acc + row.higienizados, 0);
  const totalSemRespostaAPI = tableData.reduce((acc, row) => acc + row.semRespostaAPI, 0);

  return (
    <>
      <Table bordered striped responsive>
        <thead>
          <tr>
            <th>Selecionar</th>
            <th onClick={() => requestSort('lote')} style={{ cursor: 'pointer' }}>
              Lote{getSortIcon('lote')}
            </th>
            <th onClick={() => requestSort('total')} style={{ cursor: 'pointer' }}>
              Total{getSortIcon('total')}
            </th>
            <th onClick={() => requestSort('higienizados')} style={{ cursor: 'pointer' }}>
              Higienizados{getSortIcon('higienizados')}
            </th>
            <th onClick={() => requestSort('semRespostaAPI')} style={{ cursor: 'pointer' }}>
              Sem Resposta da API{getSortIcon('semRespostaAPI')}
            </th>
            <th>% Carregado</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row) => (
            <TableRow
              key={row.id}
              row={row}
              handleFileUpload={handleFileUpload}
              handleGenerateToken={handleGenerateToken}
              handlePause={handlePause}
              handleResume={handleResume}
              handleDeleteRow={handleDeleteRow}
            />
          ))}
        </tbody>
        <tfoot className="table-footer">
          <tr>
            <td>Total</td>
            <td>{totalLote}</td>
            <td>{totalTotal}</td>
            <td>{totalHigienizados}</td>
            <td>{totalSemRespostaAPI}</td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </Table>
      {totalPages > 1 && (
        <Pagination>
          <Pagination.First onClick={() => handlePageChange(1)} disabled={currentPage === 1} />
          <Pagination.Prev onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
          {[...Array(totalPages)].map((_, index) => (
            <Pagination.Item
              key={index + 1}
              active={index + 1 === currentPage}
              onClick={() => handlePageChange(index + 1)}
            >
              {index + 1}
            </Pagination.Item>
          ))}
          <Pagination.Next onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} />
          <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} />
        </Pagination>
      )}
    </>
  );
};

export default TableComponent;
