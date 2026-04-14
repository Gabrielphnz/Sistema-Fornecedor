const ID_PLANILHA = "1pW2lWXnvS0wDBu8xosLsSmlCTmwgrlWJfV4YwNTWGjg";

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Sistema de Mercado')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ===================== AUTENTICAÇÃO =====================
function validarLogin(usuario, senha) {
  try {
    const ss = SpreadsheetApp.openById(ID_PLANILHA);
    const aba = ss.getSheetByName("Usuarios");
    if (!aba) return { sucesso: false, mensagem: "Aba Usuarios não encontrada." };
    const lastRow = aba.getLastRow();
    if (lastRow <= 1) return { sucesso: false, mensagem: "Nenhum usuário cadastrado." };
    const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
    for (let i = 0; i < dados.length; i++) {
      if (dados[i][2].toString() === usuario && dados[i][3].toString() === senha) {
        const token = Utilities.getUuid();
        const usr = { nome: dados[i][1], perfil: dados[i][4], status: dados[i][5] };
        CacheService.getScriptCache().put(token, JSON.stringify(usr), 14400);
        return { sucesso: true, token: token, usuario: usr };
      }
    }
    return { sucesso: false, mensagem: "Usuário ou senha incorretos." };
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
  const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  return dados.map(r => ({ id: r[0], nome: r[1], contato: r[2], diaEntrega: r[3] }));
}

// ===================== PRODUTOS E PEDIDOS =====================
function getProdutosPorFornecedor(idFornecedor, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const abaProdutos = ss.getSheetByName("Produtos");
  if (!abaProdutos) return [];
  const lastRow = abaProdutos.getLastRow();
  if (lastRow <= 1) return [];
  const dados = abaProdutos.getRange(2, 1, lastRow - 1, abaProdutos.getLastColumn()).getValues();
  return dados.filter(row => row[1].toString() === idFornecedor.toString())
              .map(row => row.map(c => (c instanceof Date ? c.toISOString() : c)));
}

// FIX 1: Nova função que retorna objetos em vez de arrays
function getProdutosPorFornecedorSelect(idFornecedor, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const abaProdutos = ss.getSheetByName("Produtos");
  if (!abaProdutos) return [];
  const lastRow = abaProdutos.getLastRow();
  if (lastRow <= 1) return [];
  const dados = abaProdutos.getRange(2, 1, lastRow - 1, abaProdutos.getLastColumn()).getValues();
  return dados.filter(row => row[1].toString() === idFornecedor.toString())
              .map(row => ({ 
                id: row[0] || "", 
                nome: row[2] || "", 
                preco: row[3] || 0, 
                estoque: row[4] || 0 
              }));
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
  const lastRow = aba.getLastRow();
  if (lastRow <= 1) return [];
  const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  return dados.map(r => r.map(c => c instanceof Date ? c.toISOString() : c));
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

function alterarStatusPedido(idPedido, novoStatus, token) {
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

// FIX 2: Gerar PDF formatado corretamente com permissões de visualização
function gerarPDFPedido(idPedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  try {
    const ss = SpreadsheetApp.openById(ID_PLANILHA);
    const itens = ss.getSheetByName("Pedidos_Itens").getDataRange().getValues().filter(i => i[0] === idPedido);
    const pedidos = ss.getSheetByName("Pedidos_Mestre").getDataRange().getValues();
    const pedido = pedidos.find(p => p[0] === idPedido);
    
    let html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4c1130; border-bottom: 2px solid #4c1130; padding-bottom: 10px;">📦 Pedido: ${idPedido}</h2>
        <p><strong>Fornecedor:</strong> ${pedido ? pedido[1] : 'N/A'}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Prazo:</strong> ${pedido ? pedido[4] : ''} dias</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f4f4f4; text-align: left;">
              <th style="padding: 10px; border: 1px solid #ddd;">Produto</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Qtd</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Preço Un.</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    let totalGeral = 0;
    itens.forEach(i => { 
      let sub = parseFloat(i[2]) * parseFloat(i[3]);
      if(i[4] === 'Sim') sub = 0; // Bonificado
      totalGeral += sub;
      html += `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">${i[1]} ${i[4] === 'Sim' ? '<i>(Bonif.)</i>' : ''}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${i[3]}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">R$ ${parseFloat(i[2]).toFixed(2)}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">R$ ${sub.toFixed(2)}</td>
        </tr>
      `; 
    });
    
    html += `
          </tbody>
        </table>
        <h3 style="text-align: right; margin-top: 20px; color: #4c1130;">Total Geral: R$ ${totalGeral.toFixed(2)}</h3>
        <p style="margin-top: 30px; font-size: 12px; color: #666;"><strong>Observações:</strong> ${pedido ? pedido[6] : ''}</p>
      </div>
    `;
    
    const pdfBlob = HtmlService.createHtmlOutput(html).getAs('application/pdf').setName(`${idPedido}.pdf`);
    const file = DriveApp.createFile(pdfBlob);
    // FIX 2: Adiciona permissão de visualização para o arquivo
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log("Erro ao gerar PDF: " + e.message);
    throw new Error("Erro ao gerar PDF: " + e.message);
  }
}

function getUltimosPedidosFornecedor(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const dados = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre").getDataRange().getValues();
  return dados.slice(1).filter(p => p[7] === fornecedorId).slice(-5).reverse();
}

// FIX 3: Dashboard com dados de gastos e fornecedores
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

// ===================== MÓDULO TROCAS / DEVOLUÇÕES =====================
function salvarTroca(troca, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let aba = ss.getSheetByName("Trocas_Devolucoes");
  if (!aba) aba = ss.insertSheet("Trocas_Devolucoes");
  const id = "TROCA-" + Date.now();
  aba.appendRow([
    id, troca.pedidoId || "", troca.fornecedorId, troca.produto,
    troca.quantidade, troca.valor, troca.tipo, troca.observacao,
    new Date(), "Pendente"
  ]);
  return id;
}

function getTrocasPorFornecedor(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Trocas_Devolucoes");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues().slice(1);
  return dados.filter(row => row[2].toString() === fornecedorId.toString())
              .map(row => ({
                id: row[0], pedidoId: row[1], produto: row[3],
                quantidade: row[4], valor: row[5], tipo: row[6],
                obs: row[7], data: row[8], status: row[9]
              }));
}

function resolverTroca(idTroca, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Trocas_Devolucoes");
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === idTroca) {
      aba.getRange(i+1, 10).setValue("Resolvido");
      return true;
    }
  }
  return false;
}
