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

// ===================== FALTANTES (Histórico unificado) =====================
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

function getItensFaltantesPorFornecedor(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Historico_Falhas");
  if (!aba) return [];
  const lastRow = aba.getLastRow();
  if (lastRow <= 1) return [];
  const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  return dados.filter(row => row[1].toString() === fornecedorId.toString() && row[5] === "Pendente")
              .map(row => ({ pedidoId: row[4], produto: row[2], quantidade: row[3], data: row[0] }));
}

function marcarItensFaltantesComoResolvidos(fornecedorId, produtos, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Historico_Falhas");
  if (!aba) return false;
  const lastRow = aba.getLastRow();
  if (lastRow <= 1) return false;
  const dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  for (let i = 0; i < dados.length; i++) {
    if (dados[i][1].toString() === fornecedorId.toString() && produtos.includes(dados[i][2])) {
      aba.getRange(i + 2, 6).setValue("Resolvido");
    }
  }
  return true;
}

function getRankingFornecedores(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const aba = SpreadsheetApp.openById(ID_PLANILHA).getSheetByName("Historico_Falhas");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues().slice(1);
  const ranking = {};
  dados.forEach(f => {
    const fornecedorId = f[1];
    const qtd = Number(f[3]) || 0;
    ranking[fornecedorId] = (ranking[fornecedorId] || 0) + qtd;
  });
  return ranking;
}

function getDashboard(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const dados = SpreadsheetApp.openById(ID_PLANILHA)
    .getSheetByName("Pedidos_Mestre")
    .getDataRange().getValues().slice(1);
  const resumo = {};
  dados.forEach(p => {
    const fornecedorId = p[7];
    resumo[fornecedorId] = (resumo[fornecedorId] || 0) + 1;
  });
  return resumo;
}

// ===================== EXTRAS =====================
function registrarEntradaEstoque(idPedido) {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const itens = ss.getSheetByName("Pedidos_Itens")
    .getDataRange().getValues()
    .filter(i => i[0] === idPedido);
  let aba = ss.getSheetByName("Estoque");
  if (!aba) aba = ss.insertSheet("Estoque");
  const linhas = itens.map(i => [i[1], i[3], new Date(), "ENTRADA"]);
  if (linhas.length > 0)
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


function enviarWhats(numero, msg) {
  const url = "https://api.z-api.io/instances/SEU_ID/token/SEU_TOKEN/send-text";
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ phone: numero, message: msg })
  });
}

function getMapaFornecedores() {
  const dados = SpreadsheetApp.openById(ID_PLANILHA)
    .getSheetByName("Fornecedores")
    .getDataRange().getValues().slice(1);
  const mapa = {};
  dados.forEach(f => { mapa[f[0]] = { nome: f[1], contato: f[2] }; });
  return mapa;
}

// ===================== ITENS FALTANTES NÃO RESOLVIDOS =====================
function getItensFaltantesNaoResolvidos(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Historico_Falhas");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues().slice(1);
  const pendentes = dados.filter(row => row[1].toString() === fornecedorId.toString() && row[5] === "Pendente")
                         .map(row => ({
                           produto: row[2],
                           qtdFaltante: row[3],
                           pedidoId: row[4],
                           data: row[0]
                         }));
  // Agrupar por produto (somar quantidades)
  const mapa = new Map();
  pendentes.forEach(p => {
    if (mapa.has(p.produto)) {
      mapa.get(p.produto).qtdFaltante += p.qtdFaltante;
    } else {
      mapa.set(p.produto, { produto: p.produto, qtdFaltante: p.qtdFaltante });
    }
  });
  return Array.from(mapa.values());
}

// ===================== TROCAS / DEVOLUÇÕES =====================
function salvarTroca(troca, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let aba = ss.getSheetByName("Trocas_Devolucoes");
  if (!aba) aba = ss.insertSheet("Trocas_Devolucoes");
  const id = "TROCA-" + Date.now();
  aba.appendRow([
    id,
    troca.pedidoId || "",
    troca.fornecedorId,
    troca.produto,
    troca.quantidade,
    troca.valor,
    troca.tipo, // "Troca" ou "Devolucao"
    troca.observacao,
    new Date(),
    "Pendente"
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
                id: row[0],
                pedidoId: row[1],
                produto: row[3],
                quantidade: row[4],
                valor: row[5],
                tipo: row[6],
                obs: row[7],
                data: row[8],
                status: row[9]
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

// Adicione ao final do arquivo, antes do último }

function getDashboardData(token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const pedidos = ss.getSheetByName("Pedidos_Mestre").getDataRange().getValues().slice(1);
  const faltas = ss.getSheetByName("Historico_Falhas") ? ss.getSheetByName("Historico_Falhas").getDataRange().getValues().slice(1) : [];
  
  // Contagem de pedidos por fornecedor
  const pedidosPorFornecedor = {};
  const entregasNoPrazo = {};
  const hoje = new Date();
  
  pedidos.forEach(p => {
    const fornecedorId = p[7];
    const fornecedorNome = p[1];
    const status = p[3];
    const dataPedido = new Date(p[2]);
    const prazo = p[4] ? new Date(p[4]) : null;
    
    if (!pedidosPorFornecedor[fornecedorNome]) {
      pedidosPorFornecedor[fornecedorNome] = { total: 0, entregues: 0, atrasados: 0 };
    }
    pedidosPorFornecedor[fornecedorNome].total++;
    if (status === "Entregue") pedidosPorFornecedor[fornecedorNome].entregues++;
    if (prazo && prazo < hoje && status !== "Entregue") pedidosPorFornecedor[fornecedorNome].atrasados++;
  });
  
  // Ranking de fornecedores por menor número de faltas
  const faltasPorFornecedor = {};
  faltas.forEach(f => {
    const id = f[1];
    const qtd = f[3];
    faltasPorFornecedor[id] = (faltasPorFornecedor[id] || 0) + qtd;
  });
  
  const fornecedores = ss.getSheetByName("Fornecedores").getDataRange().getValues().slice(1);
  const ranking = fornecedores.map(f => ({ nome: f[1], faltas: faltasPorFornecedor[f[0]] || 0, id: f[0] }))
                               .sort((a,b) => a.faltas - b.faltas);
  
  return { pedidosPorFornecedor, ranking };
}
function obterNomeFornecedor(id) {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Fornecedores");
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] == id) return dados[i][1];
  }
  return id;
}

function getFornecedorWhats(idFornecedor, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Fornecedores");
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] == idFornecedor) return dados[i][2]; // contato
  }
  return "";
}

// Função de envio (exemplo com Z-API – ajuste seus dados)
function enviarMensagemWhatsApp(numero, mensagem) {
  // Exemplo com Z-API – substitua pelos seus dados
  const url = "https://api.z-api.io/instances/SUA_INSTANCIA/token/SEU_TOKEN/send-text";
  const payload = {
    phone: numero,
    message: mensagem
  };
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };
  try {
    UrlFetchApp.fetch(url, options);
  } catch(e) { Logger.log("Erro WhatsApp: "+e); }
}

// Deixe APENAS UMA versão de alterarStatusPedido (a mais completa, com resolução de faltas)
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
      // Se for Entregue, resolve as faltas deste pedido
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

// Corrija gerarPDFPedido para aceitar token e passar para verificarSessao
function gerarPDFPedido(idPedido, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada.");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const itens = ss.getSheetByName("Pedidos_Itens").getDataRange().getValues().filter(i => i[0] === idPedido);
  const pedidos = ss.getSheetByName("Pedidos_Mestre").getDataRange().getValues();
  const pedido = pedidos.find(p => p[0] === idPedido);
  let html = `<h2>Pedido ${idPedido}</h2><p>Fornecedor: ${pedido ? pedido[1] : 'N/A'}</p><p>Data: ${new Date().toLocaleDateString()}</p><ul>`;
  itens.forEach(i => { html += `<li>${i[1]} - Qtd: ${i[3]} - R$ ${parseFloat(i[2]).toFixed(2)}</li>`; });
  html += `</ul>`;
  const blob = HtmlService.createHtmlOutput(html).getBlob().setName(`${idPedido}.pdf`);
  const file = DriveApp.createFile(blob);
  return file.getUrl();
}

function getProdutosPorFornecedorSelect(fornecedorId, token) {
  if (!verificarSessao(token)) throw new Error("Sessão expirada");
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("Produtos");
  if (!aba) return [];
  const dados = aba.getDataRange().getValues().slice(1);
  const filtrados = dados.filter(row => row[1].toString() === fornecedorId.toString());
  return filtrados.map(row => ({ nome: row[2], preco: row[3] }));
}
