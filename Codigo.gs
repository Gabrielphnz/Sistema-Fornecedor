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
    const dados = aba.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
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
  const dados = aba.getDataRange().getValues();
  if (dados.length <= 1) return [];
  return dados.slice(1).map(r => ({ id: r[0], nome: r[1], contato: r[2], diaEntrega: r[3] }));
}

// ===================== PRODUTOS E PEDIDOS =====================
function getProdutosPorFornecedor(idFornecedor, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const abaProdutos = ss.getSheetByName("Produtos");
  if (!abaProdutos) return [];
  const dados = abaProdutos.getDataRange().getValues();
  return dados.slice(1)
    .filter(row => row[1].toString() === idFornecedor.toString())
    .map(row => row.map(c => (c instanceof Date ? c.toISOString() : c)));
}

function salvarPedido(pedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const abaMestre = ss.getSheetByName("Pedidos_Mestre");
  const abaItens = ss.getSheetByName("Pedidos_Itens");
  const abaProdutos = ss.getSheetByName("Produtos");
  const idPedido = "PED-" + Date.now();
  
  abaMestre.appendRow([idPedido, pedido.nomeFornecedor, new Date(), "Pendente", pedido.prazo, pedido.financeiro, pedido.obs, pedido.idFornecedor]);
  
  const produtosExistentes = abaProdutos.getDataRange().getValues()
    .filter(r => r[1].toString() === pedido.idFornecedor.toString())
    .map(r => r[2].toString().toLowerCase());
    
  for (let item of pedido.itens) {
    abaItens.appendRow([idPedido, item.nome, item.preco, item.qtd, item.bonificado, item.validade]);
    if (!produtosExistentes.includes(item.nome.toLowerCase())) {
      abaProdutos.appendRow(["PROD-" + Date.now(), pedido.idFornecedor, item.nome, item.preco, ""]);
    }
  }
  return idPedido;
}

function getPedidosStatus(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre");
  const dados = aba.getDataRange().getValues();
  if (dados.length <= 1) return [];
  // Converte datas para texto para o Javascript não crashar
  return dados.slice(1).map(r => r.map(c => c instanceof Date ? c.toISOString() : c));
}

function alterarStatusPedido(idPedido, novoStatus, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre");
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === idPedido) {
      aba.getRange(i+1, 4).setValue(novoStatus);
      return true;
    }
  }
  throw new Error("Pedido não encontrado.");
}

function excluirPedido(idPedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre");
  const dados = aba.getDataRange().getValues();
  for (let i = dados.length-1; i >= 1; i--) {
    if (dados[i][0] === idPedido) {
      aba.deleteRow(i+1);
      return true;
    }
  }
  throw new Error("Não foi possível excluir.");
}

function getDetalhesPedido(idPedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Itens");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues();
  return dados.slice(1)
    .filter(r => r[0] === idPedido)
    .map(row => row.map(cell => (cell instanceof Date ? cell.toISOString() : cell)));
}

// --- FUNÇÃO QUE ESTAVA FALTANDO ---
function registrarItensFaltantes(pedidoId, fornecedorId, faltantes, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Historico_Falhas");
  
  if (!aba) throw new Error("Aba 'Historico_Falhas' não encontrada!");

  faltantes.forEach(f => {
    // Grava: Data | Produto | Qtd Faltante | ID Pedido | Fornecedor
    aba.appendRow([new Date(), f.nome, f.qtdFaltante, pedidoId, fornecedorId]);
  });
  return true;
}

function getItensFaltantesPorFornecedor(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Itens_Faltantes");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues();
  if (dados.length <= 1) return [];
  return dados.slice(1)
    .filter(row => row[1].toString() === fornecedorId.toString() && row[5] === "Pendente")
    .map(row => ({ pedidoId: row[0], produto: row[2], quantidade: row[3], data: row[4] }));
}

function marcarItensFaltantesComoResolvidos(fornecedorId, produtos, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Itens_Faltantes");
  if (!aba) return false;
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][1].toString() === fornecedorId.toString() && produtos.includes(dados[i][2])) {
      aba.getRange(i+1, 6).setValue("Resolvido");
    }
  }
  return true;
}
