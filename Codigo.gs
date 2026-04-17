const ID_PLANILHA = "1pW2lWXnvS0wDBu8xosLsSmlCTmwgrlWJfV4YwNTWGjg";

function ok(dados, mensagem) {
  return { sucesso: true, dados: dados || null, mensagem: mensagem || "" };
}

function erro(mensagem) {
  return { sucesso: false, mensagem: mensagem || "Erro" };
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Gestão de Pedidos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function validarLogin(usuario, senha) {
  try {
    const ss = SpreadsheetApp.openById(ID_PLANILHA);
    const aba = ss.getSheetByName("Usuarios");
    if (!aba) return { sucesso: false, mensagem: "Aba Usuarios não encontrada." };
    
    const lastRow = aba.getLastRow();
    if (lastRow <= 1) return { sucesso: false, mensagem: "Nenhum utilizador cadastrado." };
    
    const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
    
    // Limpeza de segurança
    const u = usuario.trim();
    const s = senha.trim();

    for (let i = 0; i < dados.length; i++) {
      // Limpa os dados vindos da folha de cálculo na hora de comparar
      if (dados[i][2].toString().trim() === u && dados[i][3].toString().trim() === s) {
        const token = Utilities.getUuid();
        const usr = { nome: dados[i][1], perfil: dados[i][4], status: dados[i][5] };
        CacheService.getScriptCache().put(token, JSON.stringify(usr), 14400);
        return { sucesso: true, token: token, usuario: usr };
      }
    }
    return { sucesso: false, mensagem: "Utilizador ou palavra-passe incorretos." };
  } catch (e) {
    return { sucesso: false, mensagem: "Erro interno: " + e.message };
  }
}


function verificarSessao(token) {
  return token && CacheService.getScriptCache().get(token) !== null;
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove(token);
  return true;
}

function forcarAutorizacao() {
  SpreadsheetApp.openById(ID_PLANILHA).getName();
  return "Autorização OK! Recarregue a página.";
}

// ===================== FORNECEDORES =====================
function salvarFornecedor(dados, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Fornecedores");
  const id = "FORN-" + Date.now();
  aba.appendRow([id, dados.nome, dados.contato, dados.diaEntrega]);
  return { id: id, nome: dados.nome };
}

function getFornecedores(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Fornecedores");
  if (!aba) return [];
  const lastRow = aba.getLastRow();
  if (lastRow <= 1) return [];
  const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues().filter(r => r[0] !== "");
  return dados.map(r => ({ id: r[0], nome: r[1], contato: r[2], diaEntrega: r[3] }));
}

// ===================== PRODUTOS E PEDIDOS =====================

function getProdutosPorFornecedor(fornecedorId) {
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Historico_Preco");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues().slice(1);

  const filtrados = dados.filter(l => l[1] == fornecedorId);

  return [...new Set(filtrados.map(l => l[2]))]; // nomes únicos
}

function getUltimoPreco(produto, fornecedorId) {
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Historico_Preco");
  if (!aba) return "";
  const dados = aba.getDataRange().getValues().slice(1);

  const filtrados = dados
    .filter(l => l[1] == fornecedorId && l[2].toLowerCase() == produto.toLowerCase())
    .sort((a,b) => new Date(b[4]) - new Date(a[4]));

  return filtrados[0]?.[3] || "";
}

function getPendenciasFornecedor(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const pendencias = [];

  const abaTrocas = ss.getSheetByName("Trocas_Devolucoes");
  if (abaTrocas) {
    const trocas = abaTrocas.getDataRange().getValues().slice(1);
    trocas.forEach(row => {
      if (row[2].toString() === fornecedorId.toString() && row[9] !== "Resolvido") {
        pendencias.push({
          tipo: "troca",
          origemId: row[0],
          pedidoId: row[1],
          produto: row[3],
          quantidade: Number(row[4]) || 0,
          valor: Number(row[5]) || 0,
          descricao: `Troca pendente: ${row[3]} (${row[4]})`
        });
      }
    });
  }

  const abaFalhas = ss.getSheetByName("Historico_Falhas");
  if (abaFalhas) {
    const falhas = abaFalhas.getDataRange().getValues().slice(1);
    falhas.forEach(row => {
      if (row[1].toString() === fornecedorId.toString() && row[5] === "Pendente") {
        pendencias.push({
          tipo: "falta",
          origemId: `${row[4]}-${row[2]}`,
          pedidoId: row[4],
          produto: row[2],
          quantidade: Number(row[3]) || 0,
          valor: 0,
          descricao: `Falta pendente: ${row[2]} (${row[3]})`
        });
      }
    });
  }

  return pendencias;
}

function getSeta(precoAtual, nome) {
  const anterior = historico[nome.toLowerCase()];
  if (!anterior) return '';

  if (precoAtual > anterior) return '<span style="color:#e74c3c;">▲</span>';
  if (precoAtual < anterior) return '<span style="color:#27ae60;">▼</span>';
  return '';
}

function salvarPedido(pedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let abaMestre = ss.getSheetByName("Pedidos_Mestre");
  if (!abaMestre) abaMestre = ss.insertSheet("Pedidos_Mestre");
  let abaItens = ss.getSheetByName("Pedidos_Itens");
  if (!abaItens) abaItens = ss.insertSheet("Pedidos_Itens");

  const idPedido = "PED-" + Date.now();
  abaMestre.appendRow([
    idPedido,
    pedido.nomeFornecedor,
    new Date(),
    "Pendente",
    pedido.prazo,
    pedido.financeiro,
    pedido.obs,
    pedido.idFornecedor
  ]);
  const linhas = pedido.itens.map(item => [
    idPedido,
    item.nome,
    parseFloat(item.preco),
    item.qtd,
    item.bonificado,
    item.validade
  ]);
  if (linhas.length > 0) {
    abaItens.getRange(abaItens.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
  }
  return idPedido;
}

function getPedidosStatus(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");

  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre");
  if (!aba) return [];

  return aba.getDataRange().getValues().slice(1).filter(r => r[0] !== "");
}

function excluirPedido(idPedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre");
  if (!aba) throw new Error("Aba não encontrada.");
  const lastRow = aba.getLastRow();
  if (lastRow <= 1) return false;
  const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  for (let i = dados.length - 1; i >= 0; i--) {
    if (dados[i][0] === idPedido) {
      aba.deleteRow(i + 2);
      return true;
    }
  }
  throw new Error("Não foi possível excluir.");
}

function getDetalhesPedido(idPedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Itens");
  if (!aba) return [];
  const lastRow = aba.getLastRow();
  if (lastRow <= 1) return [];
  const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  return dados.filter(r => r[0] === idPedido)
              .map(row => row.map(cell => (cell instanceof Date ? cell.toISOString() : cell)));
}

// ===================== FALTANTES =====================
function registrarItensFaltantes(pedidoId, fornecedorId, faltantes, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let aba = ss.getSheetByName("Historico_Falhas");
  if (!aba) aba = ss.insertSheet("Historico_Falhas");
  faltantes.forEach(f => {
    aba.appendRow([new Date(), fornecedorId, f.nome, f.qtdFaltante, pedidoId, "Pendente"]);
  });
  return true;
}

function getItensFaltantesNaoResolvidos(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Historico_Falhas");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues().slice(1);
  const pendentes = dados.filter(row => row[1].toString() === fornecedorId.toString() && row[5] === "Pendente")
                         .map(row => ({ produto: row[2], qtdFaltante: row[3], pedidoId: row[4], data: row[0] }));
  const mapa = new Map();
  pendentes.forEach(p => {
    if (mapa.has(p.produto)) { mapa.get(p.produto).qtdFaltante += p.qtdFaltante; } 
    else { mapa.set(p.produto, { produto: p.produto, qtdFaltante: p.qtdFaltante }); }
  });
  return Array.from(mapa.values());
}

function alterarStatusPedido(idPedido, novoStatus, token, observacao = "") {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Pedidos_Mestre");
  if (!aba) throw new Error("Aba não encontrada.");
  const lastRow = aba.getLastRow();
  if (lastRow <= 1) return false;
  const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  for (let i = 0; i < dados.length; i++) {
    if (dados[i][0] === idPedido) {
      aba.getRange(i + 2, 4).setValue(novoStatus);
      if (observacao) {
        // Assume que a coluna 9 (I) é para observações de entrega
        aba.getRange(i + 2, 9).setValue(observacao);
      }
      if (novoStatus === "Entregue") {
        const faltasAba = ss.getSheetByName("Historico_Falhas");
        if (faltasAba) {
          const faltasDados = faltasAba.getDataRange().getValues().slice(1);
          for (let j = 0; j < faltasDados.length; j++) {
            if (faltasDados[j][4] === idPedido && faltasDados[j][5] === "Pendente") {
              faltasAba.getRange(j + 2, 6).setValue("Resolvido");
            }
          }
        }
      }
      return true;
    }
  }
  throw new Error("Pedido não encontrado.");
}

function gerarPDFPedido(idPedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");

  try {
    const ss = SpreadsheetApp.openById(ID_PLANILHA);

    const abaItens = ss.getSheetByName("Pedidos_Itens");
    const abaPedidos = ss.getSheetByName("Pedidos_Mestre");

    if (!abaItens || !abaPedidos) {
      throw new Error("Abas necessárias não encontradas.");
    }

    const itens = abaItens.getDataRange().getValues().filter(i => i[0] === idPedido);
    const pedidos = abaPedidos.getDataRange().getValues();

    const pedido = pedidos.find(p => p[0] === idPedido);

    if (!pedido) {
      throw new Error("Pedido não encontrado.");
    }

    let html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4c1130;">📦 Pedido: ${idPedido}</h2>
        <p><strong>Fornecedor:</strong> ${pedido[1]}</p>
        <p><strong>Data:</strong> ${new Date(pedido[2]).toLocaleDateString()}</p>
        <p><strong>Prazo:</strong> ${pedido[4]} dias</p>

        <table style="width:100%; border-collapse: collapse; margin-top:20px;">
          <tr>
            <th>Produto</th>
            <th>Qtd</th>
            <th>Preço</th>
            <th>Total</th>
          </tr>
    `;

    let total = 0;

    itens.forEach(i => {
      let sub = parseFloat(i[2]) * parseFloat(i[3]);
      if (i[4] === 'Sim') sub = 0;

      total += sub;

      html += `
        <tr>
          <td>${i[1]}</td>
          <td>${i[3]}</td>
          <td>R$ ${parseFloat(i[2]).toFixed(2)}</td>
          <td>R$ ${sub.toFixed(2)}</td>
        </tr>
      `;
    });

    html += `
        </table>
        <h3>Total: R$ ${total.toFixed(2)}</h3>
    `;

    // ✅ TROCAS (CORRIGIDO)
    const trocas = getTrocaPorPedido(idPedido, token) || [];

    if (trocas.length > 0) {
      html += `
        <h3 style="margin-top:20px;">🔄 Trocas / Devoluções</h3>
        <table style="width:100%; border-collapse: collapse;">
          <tr>
            <th>Produto</th>
            <th>Qtd</th>
            <th>Tipo</th>
            <th>Valor</th>
          </tr>
      `;

      trocas.forEach(t => {
        html += `
          <tr>
            <td>${t.produto}</td>
            <td>${t.quantidade}</td>
            <td>${t.tipo}</td>
            <td>R$ ${(parseFloat(t.valor) || 0).toFixed(2)}</td>
          </tr>
        `;
      });

      html += `</table>`;
    }

    html += `</div>`;

    const pdfBlob = HtmlService
      .createHtmlOutput(html)
      .getAs('application/pdf')
      .setName(`${idPedido}.pdf`);

    const file = DriveApp.createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);

    return file.getUrl();

  } catch (e) {
    throw new Error("Erro ao gerar PDF: " + e.message);
  }
}


function getUltimosPedidosFornecedor(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const dados = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre").getDataRange().getValues();
  return dados.slice(1).filter(p => p[7] === fornecedorId).slice(-5).reverse();
}

function getDashboardData(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const pedidos = ss.getSheetByName("Pedidos_Mestre").getDataRange().getValues().slice(1);
  const itens = ss.getSheetByName("Pedidos_Itens").getDataRange().getValues().slice(1);
  
  const pedidosPorFornecedor = {};
  let totalMes = 0;
  
  pedidos.forEach(p => {
    const fornecedorNome = p[1];
    if (!pedidosPorFornecedor[fornecedorNome]) {
      pedidosPorFornecedor[fornecedorNome] = { total: 0, entregues: 0, gasto: 0 };
    }
    pedidosPorFornecedor[fornecedorNome].total++;
    if (p[3] === "Entregue") pedidosPorFornecedor[fornecedorNome].entregues++;
  });
  
  itens.forEach(i => {
    const sub = parseFloat(i[2]) * parseFloat(i[3]);
    totalMes += sub;
    const pedidoId = i[0];
    const pedido = pedidos.find(p => p[0] === pedidoId);
    if (pedido) {
      const fornecedorNome = pedido[1];
      if (pedidosPorFornecedor[fornecedorNome]) {
        pedidosPorFornecedor[fornecedorNome].gasto += sub;
      }
    }
  });
  
  const ranking = Object.entries(pedidosPorFornecedor)
    .sort((a, b) => b[1].gasto - a[1].gasto)
    .slice(0, 3)
    .map(([nome, dados]) => ({ nome, gasto: dados.gasto }));
  
  return { pedidosPorFornecedor, ranking, totalMes };
}

function salvarTroca(dados, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");

  if (!dados || !dados.pedidoId || !dados.pedidoId.toString().trim()) {
    throw new Error("Selecione o pedido para registrar a troca/devolução.");
  }
  if (!dados.fornecedorId || !dados.produto) {
    throw new Error("Fornecedor e produto são obrigatórios.");
  }
  if ((Number(dados.quantidade) || 0) <= 0) {
    throw new Error("Quantidade deve ser maior que zero.");
  }

  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Trocas_Devolucoes");

  if (!aba) throw new Error("Aba Trocas_Devolucoes não encontrada.");

  aba.appendRow([
    Utilities.getUuid(),
    dados.pedidoId.toString().trim(),
    dados.fornecedorId || "",
    dados.produto.toString().trim(),
    Number(dados.quantidade) || 0,
    Number(dados.valor) || 0,
    dados.tipo || "Troca",
    dados.observacao || "",
    new Date(),
    "Ativo"
  ]);

  return true;
}

function getTrocaPorPedido(pedidoId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const trocas = getTrocas(token) || [];
  return trocas.filter(t => t.pedidoId.toString() === pedidoId.toString());
}

function getTrocasPorFornecedor(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");

  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Trocas_Devolucoes");
  if (!aba) return [];

  const dados = aba.getDataRange().getValues().slice(1);

  return dados
    .filter(row => row[2].toString() === fornecedorId.toString())
    .map(row => ({
      id: row[0],
      pedidoId: row[1],
      fornecedorId: row[2],
      produto: row[3],
      quantidade: row[4],
      valor: row[5],
      tipo: row[6],
      observacao: row[7],
      data: row[8],
      status: row[9]
    }));
}

function resolverTroca(idTroca, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");

  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Trocas_Devolucoes");
  if (!aba) throw new Error("Aba Trocas_Devolucoes não encontrada.");

  const dados = aba.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === idTroca) {
      aba.getRange(i + 1, 10).setValue("Resolvido");
      return true;
    }
  }

  throw new Error("Troca não encontrada.");
}
// ===================== CATÁLOGO E REPOSIÇÃO AUTOMÁTICA =====================

function getCatalogoFornecedor(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const abaMestre = ss.getSheetByName("Pedidos_Mestre");
  const abaItens = ss.getSheetByName("Pedidos_Itens");
  if (!abaMestre || !abaItens) return [];

  const pedidos = abaMestre.getDataRange().getValues().slice(1).filter(p => p[7] === fornecedorId);
  const idsPedidosForn = pedidos.map(p => p[0]);
  if (idsPedidosForn.length === 0) return [];

  const itens = abaItens.getDataRange().getValues().slice(1);
  const catalogo = {};

  // Guarda o último preço praticado para cada produto
  itens.forEach(i => {
    if (idsPedidosForn.includes(i[0])) {
      const nome = (i[1] || "").toString().trim();
      const preco = parseFloat(i[2]) || 0;
      if (nome) catalogo[nome.toLowerCase()] = { nome: nome, preco: preco };
    }
  });
  return Object.values(catalogo);
}

function getFaltasPendentesPorFornecedor(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Historico_Falhas");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues().slice(1);
  
  // Colunas: 0:Data, 1:FornId, 2:Nome, 3:Qtd, 4:PedidoId, 5:Status
  return dados.filter(r => r[1] === fornecedorId && r[5] === "Pendente")
              .map(r => ({ nome: r[2], qtd: r[3] }));
}

function getTrocas(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");

  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Trocas_Devolucoes");
  if (!aba) return [];

  const dados = aba.getDataRange().getValues().slice(1);

  return dados.map(row => ({
    id: row[0],
    pedidoId: row[1],
    fornecedorId: row[2],
    produto: row[3],
    quantidade: Number(row[4]) || 0,
    valor: Number(row[5]) || 0,
    tipo: row[6],
    observacao: row[7],
    data: row[8],
    status: row[9]
  }));
}


function getProdutosPorFornecedorSelect(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  return getCatalogoFornecedor(fornecedorId, token);
}
