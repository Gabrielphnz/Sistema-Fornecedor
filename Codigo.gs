// Renderiza a página principal
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Sistema Mercado & Padaria')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Função para incluir arquivos HTML (CSS/JS) separados (se necessário)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// VALIDAÇÃO DE LOGIN
function validarLogin(loginDigitado, senhaDigitada) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaUsuarios = ss.getSheetByName("Usuarios");
  const dados = abaUsuarios.getDataRange().getValues();
  dados.shift(); // Remove o cabeçalho
  
  for (let i = 0; i < dados.length; i++) {
    let [id, nome, loginStr, senhaStr, perfil, status] = dados[i];
    if (loginStr.toString() === loginDigitado && senhaStr.toString() === senhaDigitada) {
      if (status === "Ativo") {
        return {
          sucesso: true,
          usuario: { id: id, nome: nome, perfil: perfil }
        };
      } else {
        return { sucesso: false, mensagem: "Usuário inativo." };
      }
    }
  }
  return { sucesso: false, mensagem: "Login ou senha incorretos." };
}

// BUSCAR FORNECEDORES
function getFornecedores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Fornecedores");
  const dados = aba.getDataRange().getValues();
  dados.shift(); 
  return dados.map(r => ({id: r[0], nome: r[1], diaEntrega: r[3]}));
}

// BUSCAR PRODUTOS POR FORNECEDOR
function getProdutosPorFornecedor(idFornecedor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Produtos");
  const dados = aba.getDataRange().getValues();
  dados.shift();
  return dados.filter(r => r[1].toString() === idFornecedor.toString());
}

// SALVAR PEDIDO
function salvarPedido(dadosPedido) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaMestre = ss.getSheetByName("Pedidos_Mestre");
  const abaItens = ss.getSheetByName("Pedidos_Itens");
  const idPedido = "PED-" + new Date().getTime();
  
  abaMestre.appendRow([idPedido, dadosPedido.fornecedor, new Date(), "Pendente", dadosPedido.prazo, "Aberto", dadosPedido.obs]);
  
  dadosPedido.itens.forEach(item => {
    abaItens.appendRow([idPedido, item.nome, item.preco, item.qtd, item.bonificado, ""]);
  });
  return idPedido;
}

// STATUS DE PEDIDOS
function getPedidosStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Pedidos_Mestre");
  return aba.getDataRange().getValues().slice(1);
}

// ORDENS DE PRODUÇÃO
function getOrdensProducao() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Producao_Ordens");
  const dados = aba.getDataRange().getValues().slice(1);
  return dados.filter(r => r[3] !== "Concluído");
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
