// Corrected code for Codigo.gs

function sampleFunction() {
    try {
        for (let i = 0; i < data.length; i++) {
            let abaProdutos = data[i].abaProdutos;
            processRow(i + 2, abaProdutos);  // Adjusted to i + 2
        }
    } catch (error) {
        console.error('Error in sampleFunction:', error);
    }
}

function processRow(row, abaProdutos) {
    try {
        // Process the row with abaProdutos
    } catch (error) {
        console.error('Error processing row', row, error);
    }
}

// Additional functions can be added here with similar structure.