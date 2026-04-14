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
const lastRow = aba.getLastRow();
if (lastRow <= 1) return [];

for (let i = 0; i < dados.length; i++) {  // ✅ Começa em 0
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
  if (dados.length <= 1) return [];
  return dados.slice(1).map(r => ({ id: r[0], nome: r[1], contato: r[2], diaEntrega: r[3] }));
}

// ===================== PRODUTOS E PEDIDOS =====================
function getProdutosPorFornecedor(idFornecedor, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
const abaProdutos = ss.getSheetByName("Produtos");
if (!abaProdutos) return [];
const lastRow = abaProdutos.getLastRow();  // ✅ Use abaProdutos
const dados = abaProdutos.getRange(2, 1, lastRow - 1, abaProdutos.getLastColumn()).getValues();
  return dados.slice(1)
    .filter(row => row[1].toString() === idFornecedor.toString())
    .map(row => row.map(c => (c instanceof Date ? c.toISOString() : c)));
}

function salvarPedido(pedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");

  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const abaMestre = ss.getSheetByName("Pedidos_Mestre");
  const abaItens = ss.getSheetByName("Pedidos_Itens");

  const idPedido = "PED-" + Date.now();

  // ✅ mantém compatibilidade com seu sistema atual
  abaMestre.appendRow([
    idPedido,
    pedido.nomeFornecedor, // mantém nome
    new Date(),
    "Pendente",
    pedido.prazo,
    pedido.financeiro,
    pedido.obs,
    pedido.idFornecedor   // ID correto
  ]);

  // ✅ PERFORMANCE (batch insert)
  const linhas = pedido.itens.map(item => [
    idPedido,
    item.nome,
    parseFloat(item.preco),
    item.qtd,
    item.bonificado,
    item.validade
  ]);

  abaItens.getRange(
    abaItens.getLastRow() + 1,
    1,
    linhas.length,
    linhas[0].length
  ).setValues(linhas);

  return idPedido;
}

function getPedidosStatus(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre");
const lastRow = aba.getLastRow();
if (lastRow <= 1) return [];

const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  if (dados.length <= 1) return [];
  // Converte datas para texto para o Javascript não crashar
  return dados.slice(1).map(r => r.map(c => c instanceof Date ? c.toISOString() : c));
}

function alterarStatusPedido(idPedido, novoStatus, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Pedidos_Mestre");
const lastRow = aba.getLastRow();
if (lastRow <= 1) return [];

const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
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
const lastRow = aba.getLastRow();
if (lastRow <= 1) return [];

const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
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
const lastRow = aba.getLastRow();
if (lastRow <= 1) return [];

const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
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
const lastRow = aba.getLastRow();
if (lastRow <= 1) return [];

const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
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
const lastRow = aba.getLastRow();
if (lastRow <= 1) return [];

const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][1].toString() === fornecedorId.toString() && produtos.includes(dados[i][2])) {
      aba.getRange(i+1, 6).setValue("Resolvido");
    }
  }
  return true;
}

function getDashboard(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");

  const dados = SpreadsheetApp.openById(ID_PLANILHA)
    .getSheetByName("Pedidos_Mestre")
    .getDataRange().getValues().slice(1);

  const resumo = {};

  dados.forEach(p => {
    const fornecedorId = p[7]; // coluna correta
    resumo[fornecedorId] = (resumo[fornecedorId] || 0) + 1;
  });

  return resumo;
}

function getRankingFornecedores(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");

  const aba = SpreadsheetApp.openById(ID_PLANILHA)
    .getSheetByName("Itens_Faltantes");

  if (!aba) return [];

  const dados = aba.getDataRange().getValues().slice(1);

  const ranking = {};

  dados.forEach(f => {
    const fornecedorId = f[1]; // correto
    const qtd = Number(f[3]) || 0;

    ranking[fornecedorId] = (ranking[fornecedorId] || 0) + qtd;
  });

  return ranking;
}

function registrarEntradaEstoque(idPedido) {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const itens = ss.getSheetByName("Pedidos_Itens")
    .getDataRange().getValues()
    .filter(i => i[0] === idPedido);

  let aba = ss.getSheetByName("Estoque");
  if (!aba) aba = ss.insertSheet("Estoque");

  const linhas = itens.map(i => [
    i[1], // produto
    i[3], // quantidade
    new Date(),
    "ENTRADA"
  ]);

  aba.getRange(aba.getLastRow()+1,1,linhas.length,4).setValues(linhas);
}

function verificarPedidosAtrasados() {
  const pedidos = SpreadsheetApp.openById(ID_PLANILHA)
    .getSheetByName("Pedidos_Mestre")
    .getDataRange().getValues().slice(1);

  pedidos.forEach(p => {
    const dias = (Date.now() - new Date(p[2])) / (1000*60*60*24);

    if (dias > 3 && p[3] === "Pendente") {
      Logger.log("Pedido atrasado: " + p[0]);
    }
  });
}

function gerarPDFPedido(idPedido) {
  const itens = SpreadsheetApp.openById(ID_PLANILHA)
    .getSheetByName("Pedidos_Itens")
    .getDataRange().getValues()
    .filter(i => i[0] === idPedido);

  let html = `<h2>Pedido ${idPedido}</h2><ul>`;
  itens.forEach(i => {
    html += `<li>${i[1]} - ${i[3]}</li>`;
  });
  html += `</ul>`;

  const blob = HtmlService.createHtmlOutput(html).getBlob();
  const file = DriveApp.createFile(blob).setName(idPedido + ".pdf");

  return file.getUrl();
}

function enviarWhats(numero, msg) {
  const url = "https://api.z-api.io/instances/SEU_ID/token/SEU_TOKEN/send-text";

  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      phone: numero,
      message: msg
    })
  });
}

function getMapaFornecedores() {
  const dados = SpreadsheetApp.openById(ID_PLANILHA)
    .getSheetByName("Fornecedores")
    .getDataRange().getValues().slice(1);

  const mapa = {};

  dados.forEach(f => {
    mapa[f[0]] = {
      nome: f[1],
      contato: f[2]
    };
  });

  return mapa;
}
