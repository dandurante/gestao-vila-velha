export function numeroParaExtenso(valor: number): string {
  if (valor === 0) return "zero reais";

  const reais = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dezenas = [
    "",
    "dez",
    "vinte",
    "trinta",
    "quarenta",
    "cinquenta",
    "sessenta",
    "setenta",
    "oitenta",
    "noventa",
  ];
  const dezAteDezenove = [
    "dez",
    "onze",
    "doze",
    "treze",
    "quatorze",
    "quinze",
    "dezesseis",
    "dezessete",
    "dezoito",
    "dezenove",
  ];
  const centenas = [
    "",
    "cento",
    "duzentos",
    "trezentos",
    "quatrocentos",
    "quinhentos",
    "seiscentos",
    "setecentos",
    "oitocentos",
    "novecentos",
  ];

  function converterGrupo(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";

    let texto = "";
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) {
      texto += centenas[c];
      if (d > 0 || u > 0) texto += " e ";
    }

    if (d === 1) {
      texto += dezAteDezenove[u];
    } else {
      if (d > 1) {
        texto += dezenas[d];
        if (u > 0) texto += " e ";
      }
      if (u > 0) {
        texto += unidades[u];
      }
    }

    return texto;
  }

  function converterMilhares(n: number): string {
    if (n === 0) return "";

    let texto = "";
    const milhoes = Math.floor(n / 1000000);
    const milhares = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;

    if (milhoes > 0) {
      texto += converterGrupo(milhoes) + (milhoes === 1 ? " milhão" : " milhões");
      if (milhares > 0 || resto > 0) texto += resto === 0 && milhares === 0 ? " de " : ", ";
    }

    if (milhares > 0) {
      if (milhares === 1) {
        texto += "mil";
      } else {
        texto += converterGrupo(milhares) + " mil";
      }
      if (resto > 0) {
        // Regra do "e" para milhares: se a centena é 0 ou divisível por 100
        if (resto < 100 || resto % 100 === 0) {
          texto += " e ";
        } else {
          texto += " ";
        }
      }
    }

    if (resto > 0 || (milhoes === 0 && milhares === 0)) {
      texto += converterGrupo(resto);
    }

    return texto.trim();
  }

  let extenso = "";

  if (reais > 0) {
    extenso += converterMilhares(reais);
    extenso += reais === 1 ? " real" : " reais";
  }

  if (centavos > 0) {
    if (reais > 0) extenso += " e ";
    extenso += converterGrupo(centavos);
    extenso += centavos === 1 ? " centavo" : " centavos";
  }

  return extenso;
}
