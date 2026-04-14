const ID_PLANILHA = "1pW2lWXnvS0wDBu8xosLsSmlCTmwgrlWJfV4YwNTWGjg"; // Substitui pelo ID real!

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Sistema de Mercado')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ===================== AUTENTICAÇÃO (CACHE SEGURO) =====================
function validarLogin(usuario, senha) {
  try {
    const ss = SpreadsheetApp.openById(ID_PLANILHA);
    const aba = ss.getSheetByName("Usuarios");
    const dados = aba.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][2].toString() === usuario && dados[i][3].toString() === senha) {
        const token = Utilities.getUuid();
        const usr = { nome: dados[i][1], perfil: dados[i][4], status: dados[i][5] };
        CacheService.getScriptCache().put(token, JSON.stringify(usr), 14400); // 4 horas
        return { sucesso: true, token: token, usuario: usr };
      }
    }
    return { sucesso: false, mensagem: "Usuário ou senha incorretos." };
  } catch (e) { return { sucesso: false, mensagem: "Erro interno: " + e.message }; }
}

function verificarSessao(token) {
  return token && CacheService.getScriptCache().get(token) !== null;
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove(token);
  return true;
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
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Produtos");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues();
  if (dados.length <= 1) return [];
  // Retorna produtos do fornecedor específico
  return dados.slice(1).filter(r => r[1].toString() === idFornecedor.toString());
}

function salvarPedido(pedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const abaMestre = ss.getSheetByName("Pedidos_Mestre");
  const abaItens = ss.getSheetByName("Pedidos_Itens");
  const abaProdutos = ss.getSheetByName("Produtos");
  
  const idPedido = "PED-" + Date.now();
  
  // 1. Salva o Fechamento (Mestre)
  abaMestre.appendRow([idPedido, pedido.nomeFornecedor, new Date(), "Pendente", pedido.prazo, pedido.financeiro, pedido.obs]);
  
  // 2. Busca produtos existentes para não duplicar no histórico
  const produtosAtuais = abaProdutos.getDataRange().getValues().map(r => r[2].toString().toLowerCase());
  
  // 3. Salva os Itens
  for (let item of pedido.itens) {
    abaItens.appendRow([idPedido, item.nome, item.preco, item.qtd, item.bonificado, item.validade]);
    
    // SEGREDO DO HISTÓRICO: Se o item é novo, salva automaticamente no cadastro de produtos!
    if (!produtosAtuais.includes(item.nome.toLowerCase())) {
      abaProdutos.appendRow(["PROD-" + Date.now(), pedido.idFornecedor, item.nome, item.preco]);
      produtosAtuais.push(item.nome.toLowerCase()); // atualiza array temporário
    }
  }
  return idPedido;
}

function getPedidosStatus(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Pedidos_Mestre");
  
  if (!aba) {
    throw new Error("A aba 'Pedidos_Mestre' não existe. Verifica o nome!");
  }
  
  const dados = aba.getDataRange().getValues();
  
  // Se só tiver o cabeçalho, a lista está vazia
  if (dados.length <= 1) return []; 
  
  return dados.slice(1); // Devolve os pedidos todos
}

function alterarStatusPedido(idPedido, novoStatus, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre");
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === idPedido) {
      aba.getRange(i + 1, 4).setValue(novoStatus);
      return true;
    }
  }
  throw new Error("Pedido não encontrado.");
}

function excluirPedido(idPedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre");
  const dados = aba.getDataRange().getValues();
  for (let i = dados.length - 1; i >= 1; i--) {
    if (dados[i][0] === idPedido) {
      aba.deleteRow(i + 1);
      return true;
    }
  }
  throw new Error("Não foi possível excluir.");
}

function getDetalhesPedido(idPedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Itens");
  const dados = aba.getDataRange().getValues();
  return dados.slice(1).filter(r => r[0] === idPedido);
}

function forcarAutorizacao() {
  SpreadsheetApp.openById(ID_PLANILHA).getName();
  return "Autorização OK! Recarregue a página.";
}
