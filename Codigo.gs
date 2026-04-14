// Renderiza a página principal
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Sistema Mercado & Padaria')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Função para incluir arquivos HTML (CSS/JS) separados
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Função para buscar os dados de produção para o funcionário
function buscarOrdensProducao() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Producao_Ordens");
  const dados = aba.getDataRange().getValues();
  dados.shift(); // Remove cabeçalho
  return dados;
}

// Adicione aqui a função validarLogin que já fizemos anteriormente
/**
 * 2. FUNÇÃO DE VALIDAÇÃO DE LOGIN (Backend)
 * Esta função será chamada pela interface (celular) para validar o acesso.
 */
function validarLogin(loginDigitado, senhaDigitada) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaUsuarios = ss.getSheetByName("Usuarios");
  const dados = abaUsuarios.getDataRange().getValues();
  
  // Remove o cabeçalho
  dados.shift(); 
  
  for (let i = 0; i < dados.length; i++) {
    let [id, nome, loginStr, senhaStr, perfil, status] = dados[i];
    
    // Verifica se login e senha batem, e se o usuário está ativo
    if (loginStr.toString() === loginDigitado && senhaStr.toString() === senhaDigitada) {
      if (status === "Ativo") {
        return {
          sucesso: true,
          mensagem: "Login aprovado",
          usuario: {
            id: id,
            nome: nome,
            perfil: perfil
          }
        };
      } else {
        return { sucesso: false, mensagem: "Usuário inativo. Fale com a gerência." };
      }
    }
  }
  
  return { sucesso: false, mensagem: "Login ou senha incorretos." };
}

// Busca lista de fornecedores para o Select
function getFornecedores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Fornecedores");
  const dados = aba.getDataRange().getValues();
  dados.shift(); 
  return dados.map(r => ({id: r[0], nome: r[1], diaEntrega: r[3]}));
}

// Busca histórico de produtos de um fornecedor específico
function getProdutosPorFornecedor(idFornecedor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Produtos");
  const dados = aba.getDataRange().getValues();
  dados.shift();
  // Filtra produtos que pertencem ao fornecedor (coluna B / index 1)
  return dados.filter(r => r[1].toString() === idFornecedor.toString());
}

// Salva o pedido completo
function salvarPedido(dadosPedido) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaMestre = ss.getSheetByName("Pedidos_Mestre");
  const abaItens = ss.getSheetByName("Pedidos_Itens");
  
  const idPedido = "PED-" + new Date().getTime();
  
  // Salva no Mestre
  abaMestre.appendRow([
    idPedido, 
    dadosPedido.fornecedor, 
    new Date(), 
    "Pendente", 
    dadosPedido.prazo, 
    "Aberto", 
    dadosPedido.obs
  ]);
  
  // Salva os itens
  dadosPedido.itens.forEach(item => {
    abaItens.appendRow([idPedido, item.nome, item.preco, item.qtd, item.bonificado, item.validade]);
  });
  
  return idPedido;
}

// Busca todos os pedidos para a Tabela de Acompanhamento
function getPedidosStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Pedidos_Mestre");
  const dados = aba.getDataRange().getValues();
  dados.shift();
  return dados;
}
// Busca as ordens de produção ativas para a padaria
function getOrdensProducao() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Producao_Ordens");
  const dados = aba.getDataRange().getValues();
  dados.shift();
  // Retorna apenas ordens que não estão "Concluídas"
  return dados.filter(r => r[3] !== "Concluído");
}

// Registra a execução de um item da produção
function registrarProducao(idOrdem, produto, status, motivo, obs) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaItens = ss.getSheetByName("Producao_Itens");
  const abaFalhas = ss.getSheetByName("Historico_Falhas");
  
  // Salva o resultado na aba de itens
  abaItens.appendRow([idOrdem, produto, "", status, motivo, obs]);
  
  // Se faltou mercadoria, joga no histórico de falhas para o gerente ver nas compras
  if (motivo === "Faltou Mercadoria") {
    abaFalhas.appendRow([new Date(), produto, motivo, idOrdem, "Não"]);
  }
  
  return true;
}
