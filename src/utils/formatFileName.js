// src/utils/formatFileName.js
export const formatFileName = (filename) => {
    return filename
      .replace(/\.[^/.]+$/, "") // Remove a extensão do arquivo
      .replace(/[^a-zA-Z0-9]/g, "_") // Substitui caracteres especiais por "_"
      .toLowerCase(); // Converte para minúsculas
  };
  