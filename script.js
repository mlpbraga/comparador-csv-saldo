document.addEventListener('DOMContentLoaded', function () {
    const uploadFile1 = document.getElementById('upload-file1');
    const uploadFile2 = document.getElementById('upload-file2');
    const compareButton = document.getElementById('compare-button');

    let saldoConta = null; // Dados do arquivo de saldo da conta
    let saldoVendas = null; // Dados do arquivo de saldo do sistema de vendas

    uploadFile1.addEventListener('change', function() { readFile(this, 1); }, false);
    uploadFile2.addEventListener('change', function() { readFile(this, 2); }, false);

    compareButton.addEventListener('click', function() { compareFiles(saldoConta, saldoVendas); }, false);

    function readFile(input, fileNumber) {
        const file = input.files[0];
        if (!file) {
            return;
        }
    
        const reader = new FileReader();
        reader.onload = function(event) {
            const content = event.target.result;
            if (fileNumber === 1) {
                saldoConta = serializeSaldoConta(content);
            } else {
                saldoVendas = serializeSaldoVendas(content);
            }
    
            if (saldoConta && saldoVendas) {
                compareButton.disabled = false;
            }
        };
    
        reader.readAsText(file);
    }    
    
    function serializeSaldoConta(csvData) {
        const data = processCSV(csvData, ';');
        return data.map(row => {
            const dateParts = row['data da venda'].split('/');
            const timeParts = row['hora da venda'].split(':');
            const formattedDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
            const valorLiquido = parseFloat(row['valor líquido'].replace('.', '').replace(',', '.'));    
            return {
                dataHora: formattedDate,
                saldo: valorLiquido || 0
            };
        });
    }
    

    function serializeSaldoVendas(csvData) {
        const data = processCSV(csvData, ',');
        return data.map(row => {
            let dataHoraParts = row['Pagamento'].split(' ');
            let dateParts = dataHoraParts[0].split('/');
            let timeParts = dataHoraParts[1].split(':');
            let formattedDateTime = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);

            let saldo = parseFloat(row['Valor Previsto'].replace(/"/g, '').replace(',', '.'));

            return {
                dataHora: formattedDateTime,
                saldo: saldo
            };
        });
    }
    
    function processCSV(csvData, separator) {
        const allTextLines = csvData.split(/\r\n|\n/);
        const headers = splitCSVLine(allTextLines.shift(), separator);
        const lines = [];
    
        allTextLines.forEach(line => {
            const data = splitCSVLine(line, separator);
            const tarr = {};
            if (data.length === headers.length) {
                headers.forEach((header, i) => {
                    // Para valores encapsulados por aspas, removeremos as aspas extras aqui
                    tarr[header.trim()] = data[i].trim().replace(/^"|"$/g, '');
                });
                lines.push(tarr);
            }
        });
    
        return lines;
    }
    
    function splitCSVLine(line, separator) {
        if (separator === ';') {
            return line.split(separator);
        } else {
            // Para o caso de ',', lidar com valores encapsulados por aspas
            const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
            return line.match(regex).map(field => field.trim());
        }
    }    

    function compareFiles(data1, data2) {
        let saldoTotalConta = data1.reduce((acc, item) => acc + item.saldo, 0);
        // O saldo total de vendas é calculado uma única vez e mantido inalterado.
        let saldoTotalVendas = data2.reduce((acc, item) => acc + item.saldo, 0);
        
        let divergencias = [];
        let indicesParaRemover = new Set(); // Guardar índices dos itens de data2 que correspondem a data1
        let margemErro = 0.1; // Margem de erro para considerar que o saldo está correto

        data1.forEach(item1 => {
            let correspondenciaEncontrada = false;
    
            for (let i = 0; i < data2.length; i++) {
                let item2 = data2[i];
    
                // Verificar se a diferença de tempo está dentro da margem de 5 minutos (300000 milissegundos)
                let diferencaTempo = Math.abs(item1.dataHora - item2.dataHora);
                if (diferencaTempo <= 300000 && Math.abs(item1.saldo - item2.saldo) <= margemErro) {
                    correspondenciaEncontrada = true;
                    indicesParaRemover.add(i); // Marcar índice para remoção
                    divergencias.push({ dataHora: formatarDataHora(item1.dataHora), saldo: item1.saldo, correspondencia: true });
                    break;
                }
            }
    
            if (!correspondenciaEncontrada) {
                divergencias.push({ dataHora: formatarDataHora(item1.dataHora), saldo: item1.saldo, correspondencia: false });
            }
        });
    
        // Remover itens correspondentes de data2
        if (indicesParaRemover.size > 0) {
            data2 = data2.filter((_, index) => !indicesParaRemover.has(index));
        }
    
        displayDivergencias(divergencias);
        displaySaldos(saldoTotalConta, saldoTotalVendas);
    }
    
    function formatarDataHora(dataHora) {
        let dia = dataHora.getDate().toString().padStart(2, '0');
        let mes = (dataHora.getMonth() + 1).toString().padStart(2, '0');
        let ano = dataHora.getFullYear();
        let hora = dataHora.getHours().toString().padStart(2, '0');
        let minutos = dataHora.getMinutes().toString().padStart(2, '0');
        return `${dia}/${mes}/${ano} ${hora}:${minutos}`;
    }
    
    
     
    
    function displayDivergencias(divergencias) {
        const container = document.getElementById('divergencias');
        container.innerHTML = '';
    
        divergencias.forEach(div => {
            const divElement = document.createElement('div');
            divElement.innerHTML = `${div.dataHora} → R$ ${div.saldo.toFixed(2)} ${div.correspondencia ? '✅' : '❌'}`;
            divElement.style.color = div.correspondencia ? 'green' : 'red';
            container.appendChild(divElement);
        });
    }
    
    function displaySaldos(saldoTotalConta, saldoTotalVendas) {
        const saldosContainer = document.getElementById('saldos');
        saldosContainer.innerHTML = `<p>Saldo Total Conta: R$ ${saldoTotalConta.toFixed(2)}</p>
                                     <p>Saldo Total Vendas: R$ ${saldoTotalVendas.toFixed(2)}</p>`;
    }
});
