// Funções para cálculo de descontos CLT (INSS e IR)
// Tabelas atualizadas para 2025

/**
 * Calcula o desconto de INSS com base no salário bruto
 * Tabela INSS 2025 (progressiva)
 */
function calcularINSS(salarioBruto) {
    const faixas = [
        { limite: 1412.00, aliquota: 0.075 },
        { limite: 2666.68, aliquota: 0.09 },
        { limite: 4000.03, aliquota: 0.12 },
        { limite: 7786.02, aliquota: 0.14 }
    ];
    
    let desconto = 0;
    let salarioRestante = salarioBruto;
    let faixaAnterior = 0;
    
    for (let faixa of faixas) {
        if (salarioRestante <= 0) break;
        
        const baseCalculo = Math.min(salarioRestante, faixa.limite - faixaAnterior);
        desconto += baseCalculo * faixa.aliquota;
        
        salarioRestante -= baseCalculo;
        faixaAnterior = faixa.limite;
    }
    
    return desconto;
}

/**
 * Calcula o desconto de Imposto de Renda com base no salário após desconto do INSS
 * Tabela IR 2025 (progressiva)
 */
function calcularIR(salarioBruto, descontoINSS, dependentes = 0) {
    const baseCalculo = salarioBruto - descontoINSS;
    const deducaoPorDependente = 189.59;
    const deducaoDependentes = dependentes * deducaoPorDependente;
    
    const baseCalculoIR = baseCalculo - deducaoDependentes;
    
    const faixas = [
        { limite: 2259.20, aliquota: 0, deducao: 0 },
        { limite: 2826.65, aliquota: 0.075, deducao: 169.44 },
        { limite: 3751.05, aliquota: 0.15, deducao: 381.44 },
        { limite: 4664.68, aliquota: 0.225, deducao: 662.77 },
        { limite: Infinity, aliquota: 0.275, deducao: 896.00 }
    ];
    
    for (let faixa of faixas) {
        if (baseCalculoIR <= faixa.limite) {
            const ir = Math.max(0, (baseCalculoIR * faixa.aliquota) - faixa.deducao);
            return ir;
        }
    }
    
    return 0;
}

/**
 * Calcula o salário líquido a partir do salário bruto
 * @param {number} salarioBruto - Valor do salário bruto
 * @param {number} dependentes - Número de dependentes para IR (padrão: 0)
 * @param {number} outrosDescontos - Outros descontos (plano saúde, etc) (padrão: 0)
 * @returns {object} Objeto com detalhamento dos descontos e valor líquido
 */
function calcularSalarioLiquido(salarioBruto, dependentes = 0, outrosDescontos = 0) {
    const descontoINSS = calcularINSS(salarioBruto);
    const descontoIR = calcularIR(salarioBruto, descontoINSS, dependentes);
    const totalDescontos = descontoINSS + descontoIR + outrosDescontos;
    const salarioLiquido = salarioBruto - totalDescontos;
    
    return {
        salarioBruto: parseFloat(salarioBruto.toFixed(2)),
        descontoINSS: parseFloat(descontoINSS.toFixed(2)),
        descontoIR: parseFloat(descontoIR.toFixed(2)),
        outrosDescontos: parseFloat(outrosDescontos.toFixed(2)),
        totalDescontos: parseFloat(totalDescontos.toFixed(2)),
        salarioLiquido: parseFloat(salarioLiquido.toFixed(2))
    };
}

module.exports = {
    calcularINSS,
    calcularIR,
    calcularSalarioLiquido
};
