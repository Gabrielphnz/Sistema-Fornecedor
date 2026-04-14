function doGet() {
  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Sistema Mercado & Padaria')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // Resolve a tela branca
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (e) {
    return HtmlService.createHtmlOutput("Erro: " + e.message);
  }
}


function validarLogin(u, p) {
  try {
    const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
    const dados = aba.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][2].toString() === u && dados[i][3].toString() === p) {
        return { sucesso: true, usuario: { nome: dados[i][1], perfil: dados[i][4] } };
      }
    }
    return { sucesso: false, mensagem: "Login incorreto." };
  } catch (e) {
    return { sucesso: false, mensagem: "Erro de permissão. Clique em 'Desbloquear'." };
  }
}

// Adicione as outras funções (getFornecedores, etc.) conforme necessário
function getFornecedores() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName("Fornecedores");
    if (!aba) throw new Error("Aba 'Fornecedores' não encontrada na planilha!");
    
    const dados = aba.getDataRange().getValues();
    dados.shift(); 
    return dados.map(r => ({id: r[0], nome: r[1], diaEntrega: r[3]}));
  } catch (e) {
    // Registra o erro no log do Google e avisa o front
    console.error("Erro em getFornecedores: " + e.message);
    throw new Error("Erro ao buscar fornecedores. Verifique os nomes das abas.");
  }
}

// BUSCAR PRODUTOS COM AMORTECEDOR
function getProdutosPorFornecedor(idFornecedor) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName("Produtos");
    const dados = aba.getDataRange().getValues();
    dados.shift();
    return dados.filter(r => r[1].toString() === idFornecedor.toString());
  } catch (e) {
    return [];
  }
}

// SALVAR PEDIDO COM BLINDAGEM DE COMPARTILHAMENTO
function salvarPedido(dadosPedido) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaMestre = ss.getSheetByName("Pedidos_Mestre");
    const abaItens = ss.getSheetByName("Pedidos_Itens");
    const idPedido = "PED-" + new Date().getTime();
    
    abaMestre.appendRow([idPedido, dadosPedido.fornecedor, new Date(), "Pendente", dadosPedido.prazo, "Aberto", dadosPedido.obs]);
    
    dadosPedido.itens.forEach(item => {
      abaItens.appendRow([idPedido, item.nome, item.preco, item.qtd, item.bonificado, ""]);
    });
    return idPedido;
  } catch (e) {
    return "Erro ao salvar: " + e.message;
  }
}

// STATUS E PRODUÇÃO COM AMORTECEDOR
function getPedidosStatus() {
  try { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pedidos_Mestre").getDataRange().getValues().slice(1); }
  catch(e) { return []; }
}

function getOrdensProducao() {
  try {
    const dados = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Producao_Ordens").getDataRange().getValues().slice(1);
    return dados.filter(r => r[3] !== "Concluído");
  } catch(e) { return []; }
}

// REGISTRAR PRODUÇÃO
function registrarProducao(idOrdem, produto, status, motivo, obs) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaItens = ss.getSheetByName("Producao_Itens");
  const abaFalhas = ss.getSheetByName("Historico_Falhas");
  
  abaItens.appendRow([idOrdem, produto, "", status, motivo, obs]);
  
  if (motivo === "Faltou Mercadoria") {
    abaFalhas.appendRow([new Date(), produto, motivo, idOrdem, "Não"]);
  }
  return true;
}
