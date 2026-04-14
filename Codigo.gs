// Código atualizado com correções de índices de loop, referências de variáveis e cálculos de linha.

function exemplo() {
    var abaProdutos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Produtos');
    for (var i = 0; i < abaProdutos.getLastRow(); i++) {  // Alterado para i=0
        var linha = i + 2; // Ajustado de i+1 para i+2
        // Outras operações
    }
}