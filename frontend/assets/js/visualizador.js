let passos = [];
let passoAtual = -1;
let modoVisualizacao = "variaveis";
let reproduzindo = false;
let temporizadorAutomatico = null;
let multiplicadorVelocidade = 1;
let temaClaro = false;

const mapaEnderecos = {};
const enderecoBase = 0x7ffc0000;
let indiceEndereco = 0;

const canvas = document.getElementById("canvasVisualizacao");
const contexto = canvas.getContext("2d");

const CODIGO_PADRAO = `int x = 10;
int y = 20;
int soma = 0;
soma = x + y;
printf("%d", soma);`;

function obterEnderecoMemoria(nome) {
  if (!(nome in mapaEnderecos)) {
    mapaEnderecos[nome] = enderecoBase + indiceEndereco++ * 4;
  }

  return "0x" + mapaEnderecos[nome].toString(16).toUpperCase();
}

function redimensionarCanvas() {
  const contenedor = canvas.parentElement;
  const largura = contenedor.clientWidth;
  const altura = contenedor.clientHeight;

  canvas.width = largura * devicePixelRatio;
  canvas.height = altura * devicePixelRatio;
  canvas.style.width = largura + "px";
  canvas.style.height = altura + "px";
  contexto.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  if (passoAtual >= 0 && passos.length) {
    renderizarCanvas(passos[passoAtual]);
  }
}

function alternarTema() {
  temaClaro = !temaClaro;
  const definirVariavel = (nome, valor) => document.documentElement.style.setProperty(nome, valor);

  if (temaClaro) {
    definirVariavel("--bg", "#f1f5f9");
    definirVariavel("--bg2", "#e8edf5");
    definirVariavel("--bg3", "#dde4ef");
    definirVariavel("--surface", "#c8d3e4");
    definirVariavel("--border", "#c0cad9");
    definirVariavel("--border2", "#a8b5ca");
    definirVariavel("--text", "#1e2a3a");
    definirVariavel("--text2", "#3d4f68");
    definirVariavel("--text3", "#7a90aa");
  } else {
    definirVariavel("--bg", "#0d0f14");
    definirVariavel("--bg2", "#111318");
    definirVariavel("--bg3", "#161a22");
    definirVariavel("--surface", "#1e2438");
    definirVariavel("--border", "#252d40");
    definirVariavel("--border2", "#2e3850");
    definirVariavel("--text", "#e2e8f0");
    definirVariavel("--text2", "#94a3b8");
    definirVariavel("--text3", "#475569");
  }

  if (passoAtual >= 0 && passos.length) {
    renderizarCanvas(passos[passoAtual]);
  }
}

function definirIdioma(botao) {
  document.querySelectorAll(".botao-idioma").forEach((item) => item.classList.remove("ativo"));
  document.querySelectorAll(".botao-idioma").forEach((item) => {
    if (item.textContent === botao.textContent) {
      item.classList.add("ativo");
    }
  });
}

function definirNavegacaoAtiva(elemento, modo) {
  document.querySelectorAll(".item-navegacao").forEach((item) => item.classList.remove("ativo"));
  elemento.classList.add("ativo");
  definirModoVisualizacao(modo);
}

function definirModoVisualizacao(modo) {
  modoVisualizacao = modo;

  ["variaveis", "fluxo", "pilha", "arrays"].forEach((nome) => {
    const aba = document.getElementById("aba-" + nome);
    if (aba) {
      aba.classList.toggle("ativo", nome === modo);
    }
  });

  const nomes = {
    variaveis: "Variaveis e Memoria",
    fluxo: "Fluxo de Controle",
    pilha: "Pilha de Chamadas",
    arrays: "Arrays e Listas"
  };

  document.getElementById("nomeTipoVisualizacao").textContent = nomes[modo] || modo;

  if (passoAtual >= 0 && passos.length) {
    renderizarCanvas(passos[passoAtual]);
  }
}

function definirVelocidade(velocidade, botao) {
  multiplicadorVelocidade = velocidade;
  document.querySelectorAll(".botao-velocidade").forEach((item) => item.classList.remove("ativo"));
  botao.classList.add("ativo");
}

function destacarCodigo(codigo) {
  const escapar = (trecho) => trecho.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return codigo.split("\n").map((linhaBruta) => {
    const placeholders = [];
    let linha = escapar(linhaBruta);

    linha = linha.replace(/("(?:[^"\\]|\\.)*")/g, (trecho) => {
      const indice = placeholders.push(`<span class="token-string">${trecho}</span>`) - 1;
      return `__TOKEN_${indice}__`;
    });

    linha = linha.replace(/(\/\/.*$)/g, (trecho) => {
      const indice = placeholders.push(`<span class="token-comentario">${trecho}</span>`) - 1;
      return `__TOKEN_${indice}__`;
    });

    linha = linha.replace(
      /\b(int|float|double|char|void|return|if|else|for|while|do|break|continue|struct|typedef|include|define|printf|scanf|main)\b/g,
      (valor, palavra) => ["printf", "scanf", "main"].includes(palavra)
        ? `<span class="token-funcao">${palavra}</span>`
        : `<span class="token-palavra-chave">${palavra}</span>`
    );

    linha = linha.replace(/(?<![a-zA-Z_\w])(\d+\.?\d*)/g, '<span class="token-numero">$1</span>');
    linha = linha.replace(/([=+\-*\/%;,()\[\]{}])/g, '<span class="token-operador">$1</span>');
    linha = linha.replace(/__TOKEN_(\d+)__/g, (valor, indice) => placeholders[Number(indice)]);

    return linha;
  });
}

function sincronizarEditor() {
  const codigo = document.getElementById("entradaCodigo").value;
  const linhas = destacarCodigo(codigo);
  const linhaAtual = passoAtual >= 0 && passos.length ? passos[passoAtual].linha : -1;

  document.getElementById("editorDestaque").innerHTML = linhas.map((linha, indice) => `
    <div class="linha-codigo-editor${indice === linhaAtual ? " linha-atual" : ""}">
      <span class="numero-linha-editor">${indice + 1}</span><span class="conteudo-texto-editor">${linha}</span>
    </div>
  `).join("");
}

function sincronizarRolagem() {
  document.getElementById("editorDestaque").scrollTop = document.getElementById("entradaCodigo").scrollTop;
}

function tratarTab(evento) {
  if (evento.key !== "Tab") {
    return;
  }

  evento.preventDefault();

  const areaTexto = evento.target;
  const inicio = areaTexto.selectionStart;

  areaTexto.value = areaTexto.value.slice(0, inicio) + "    " + areaTexto.value.slice(areaTexto.selectionEnd);
  areaTexto.selectionStart = inicio + 4;
  areaTexto.selectionEnd = inicio + 4;

  sincronizarEditor();
}

function avaliarExpressao(expressao, variaveis) {
  let resultado = expressao.trim();

  Object.keys(variaveis)
    .sort((a, b) => b.length - a.length)
    .forEach((nome) => {
      resultado = resultado.replace(new RegExp(`\\b${nome}\\b`, "g"), variaveis[nome]);
    });

  try {
    return Function('"use strict"; return (' + resultado + ")")();
  } catch {
    return 0;
  }
}

function interpretarCodigoC(codigo) {
  const linhasBrutas = codigo.split("\n");
  const passosGerados = [];
  const variaveis = {};
  const tipos = {};
  const arrays = {};
  let saida = "";

  for (let indice = 0; indice < linhasBrutas.length; indice++) {
    const linha = linhasBrutas[indice].trim();

    if (!linha || linha.startsWith("//")) {
      continue;
    }

    const declaracaoArray = linha.match(/^(int|float)\s+(\w+)\s*\[(\d*)\]\s*(?:=\s*\{([^}]*)\})?\s*;?$/);
    if (declaracaoArray) {
      const [, tipo, nome, , valores] = declaracaoArray;
      const array = valores ? valores.split(",").map((valor) => avaliarExpressao(valor, variaveis)) : [];

      arrays[nome] = array;
      tipos[nome] = tipo + "[]";

      passosGerados.push({
        linha: indice,
        descricao: `Declara array ${nome}[]`,
        variaveis: { ...variaveis },
        tipos: { ...tipos },
        arrays: JSON.parse(JSON.stringify(arrays)),
        saida,
        alterado: nome,
        ehArray: true
      });
      continue;
    }

    const declaracao = linha.match(/^(int|float|double|char)\s+(\w+)\s*(?:=\s*(.+?))?;?$/);
    if (declaracao) {
      const [, tipo, nome, valorExpressao] = declaracao;
      const valor = valorExpressao ? avaliarExpressao(valorExpressao, variaveis) : 0;

      variaveis[nome] = valor;
      tipos[nome] = tipo;

      passosGerados.push({
        linha: indice,
        descricao: `Linha ${indice + 1}: ${nome} = ${valor}`,
        variaveis: { ...variaveis },
        tipos: { ...tipos },
        arrays: JSON.parse(JSON.stringify(arrays)),
        saida,
        alterado: nome,
        ehArray: false
      });
      continue;
    }

    const atribuicaoArray = linha.match(/^(\w+)\s*\[(.+?)\]\s*=\s*(.+?);?$/);
    if (atribuicaoArray && atribuicaoArray[1] in arrays) {
      const [, nome, indiceExpressao, valorExpressao] = atribuicaoArray;
      const posicao = avaliarExpressao(indiceExpressao, variaveis);
      const valor = avaliarExpressao(valorExpressao, variaveis);

      arrays[nome][posicao] = valor;

      passosGerados.push({
        linha: indice,
        descricao: `${nome}[${posicao}] = ${valor}`,
        variaveis: { ...variaveis },
        tipos: { ...tipos },
        arrays: JSON.parse(JSON.stringify(arrays)),
        saida,
        alterado: nome,
        indiceAlterado: posicao,
        ehArray: true
      });
      continue;
    }

    const atribuicao = linha.match(/^(\w+)\s*=\s*(.+?);?$/);
    if (atribuicao && atribuicao[1] in variaveis) {
      const [, nome, expressao] = atribuicao;
      const valor = avaliarExpressao(expressao, variaveis);

      variaveis[nome] = valor;

      passosGerados.push({
        linha: indice,
        descricao: `Linha ${indice + 1}: ${nome} = ${valor}`,
        variaveis: { ...variaveis },
        tipos: { ...tipos },
        arrays: JSON.parse(JSON.stringify(arrays)),
        saida,
        alterado: nome,
        ehArray: false
      });
      continue;
    }

    const impressao = linha.match(/printf\s*\(\s*"(.*?)"\s*(?:,\s*(.+?))?\s*\)/);
    if (impressao) {
      let [, formato, argumentos] = impressao;
      let resultado = formato.replace(/\\n/g, "\n");

      if (argumentos) {
        const argumentosAvaliados = argumentos.split(",").map((argumento) => avaliarExpressao(argumento.trim(), variaveis));
        let indiceArgumento = 0;
        resultado = resultado.replace(/%[dfsci]/g, () => argumentosAvaliados[indiceArgumento++] ?? "?");
      }

      saida += resultado;

      passosGerados.push({
        linha: indice,
        descricao: `printf -> "${resultado.replace(/\n/g, "\\n")}"`,
        variaveis: { ...variaveis },
        tipos: { ...tipos },
        arrays: JSON.parse(JSON.stringify(arrays)),
        saida,
        alterado: null,
        ehArray: false,
        ehImpressao: true
      });
      continue;
    }

    if (/^(if|for|while|else|return|break|continue)/.test(linha)) {
      passosGerados.push({
        linha: indice,
        descricao: linha,
        variaveis: { ...variaveis },
        tipos: { ...tipos },
        arrays: JSON.parse(JSON.stringify(arrays)),
        saida,
        alterado: null,
        ehControle: true
      });
    }
  }

  return passosGerados;
}

function executarCodigo() {
  Object.keys(mapaEnderecos).forEach((chave) => delete mapaEnderecos[chave]);
  indiceEndereco = 0;

  const codigo = document.getElementById("entradaCodigo").value.trim();
  if (!codigo) {
    return;
  }

  passos = interpretarCodigoC(codigo);
  if (!passos.length) {
    return;
  }

  passoAtual = 0;
  document.getElementById("dicaCanvas").classList.add("oculto");
  atualizarTudo();
}

function irParaPasso(indice) {
  const novoIndice = Math.max(0, Math.min(passos.length - 1, indice));
  passoAtual = novoIndice;
  atualizarTudo();
}

function proximoPasso() {
  if (passoAtual < passos.length - 1) {
    irParaPasso(passoAtual + 1);
  }
}

function passoAnterior() {
  if (passoAtual > 0) {
    irParaPasso(passoAtual - 1);
  }
}

function alternarReproducao() {
  reproduzindo = !reproduzindo;
  const icone = document.getElementById("iconeReproducao");

  if (reproduzindo) {
    icone.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    reproduzirAutomaticamente();
  } else {
    icone.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    clearTimeout(temporizadorAutomatico);
  }
}

function reproduzirAutomaticamente() {
  if (!reproduzindo) {
    return;
  }

  if (passoAtual >= passos.length - 1) {
    alternarReproducao();
    return;
  }

  proximoPasso();
  temporizadorAutomatico = setTimeout(reproduzirAutomaticamente, 800 / multiplicadorVelocidade);
}

function atualizarTudo() {
  if (!passos.length) {
    return;
  }

  const passo = passos[passoAtual];
  sincronizarEditor();
  renderizarCanvas(passo);
  atualizarBarraPassos();
  atualizarPainelDireito(passo);
}

function atualizarBarraPassos() {
  const total = passos.length;

  document.getElementById("trilhaPassos").innerHTML = Array.from({ length: total }, (_, indice) =>
    `<div class="ponto-passo${indice < passoAtual ? " passado" : indice === passoAtual ? " atual" : ""}" onclick="irParaPasso(${indice})" title="Passo ${indice + 1}"></div>`
  ).join("");

  document.getElementById("rotuloInfoPasso").innerHTML = `Passo <b>${passoAtual + 1}</b> de <b>${total}</b>`;
  document.getElementById("botaoPrimeiro").disabled = passoAtual === 0;
  document.getElementById("botaoAnterior").disabled = passoAtual === 0;
  document.getElementById("botaoProximo").disabled = passoAtual === total - 1;
  document.getElementById("botaoUltimo").disabled = passoAtual === total - 1;
}

function atualizarPainelDireito(passo) {
  document.getElementById("caixaInfoPasso").innerHTML = `Linha ${passo.linha + 1}: <b>${escaparHtml(passo.descricao)}</b>`;

  const caixaSaida = document.getElementById("caixaSaida");
  if (passo.saida) {
    caixaSaida.textContent = passo.saida;
    caixaSaida.className = "caixa-saida tem-saida";
  } else {
    caixaSaida.textContent = "(Nenhuma saida ainda)";
    caixaSaida.className = "caixa-saida";
  }

  const listaVariaveis = document.getElementById("listaVariaveis");
  const nomesVariaveis = Object.keys(passo.variaveis);

  if (!nomesVariaveis.length) {
    listaVariaveis.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:4px 0">Nenhuma variavel ainda.</div>';
    return;
  }

  listaVariaveis.innerHTML = nomesVariaveis.map((nome) => `
    <div class="linha-variavel${nome === passo.alterado ? " alterado" : ""}">
      <span class="nome-variavel">${nome}</span>
      <span class="seta-variavel">-></span>
      <span class="valor-variavel">${passo.variaveis[nome]}</span>
    </div>
  `).join("");
}

function obterLarguraCanvas() {
  return canvas.width / devicePixelRatio;
}

function obterAlturaCanvas() {
  return canvas.height / devicePixelRatio;
}

const cores = {
  fundo: () => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
  borda: () => getComputedStyle(document.documentElement).getPropertyValue("--border").trim(),
  bordaSecundaria: () => getComputedStyle(document.documentElement).getPropertyValue("--border2").trim(),
  superficie: () => getComputedStyle(document.documentElement).getPropertyValue("--surface").trim(),
  texto: () => getComputedStyle(document.documentElement).getPropertyValue("--text").trim(),
  textoSecundario: () => getComputedStyle(document.documentElement).getPropertyValue("--text2").trim(),
  textoSuave: () => getComputedStyle(document.documentElement).getPropertyValue("--text3").trim(),
  destaque: () => "#7c5cfc",
  destaqueSecundario: () => "#a78bfa",
  verde: () => "#22c55e",
  verdeSuave: () => "#4ade80",
  azul: () => "#60a5fa"
};

function limparCanvas() {
  contexto.fillStyle = cores.fundo();
  contexto.fillRect(0, 0, obterLarguraCanvas(), obterAlturaCanvas());
}

function desenharRetanguloArredondado(x, y, largura, altura, raio, preenchimento, contorno, larguraContorno = 1) {
  contexto.beginPath();
  contexto.roundRect(x, y, largura, altura, raio);

  if (preenchimento) {
    contexto.fillStyle = preenchimento;
    contexto.fill();
  }

  if (contorno) {
    contexto.strokeStyle = contorno;
    contexto.lineWidth = larguraContorno;
    contexto.stroke();
  }
}

function desenharTexto(texto, x, y, opcoes = {}) {
  const {
    size = 12,
    color,
    weight = "400",
    align = "left",
    mono = true
  } = opcoes;

  contexto.font = `${weight} ${size}px ${mono ? "JetBrains Mono" : "Plus Jakarta Sans"}`;
  contexto.fillStyle = color || cores.texto();
  contexto.textAlign = align;
  contexto.fillText(texto, x, y);
}

function desenharLinha(x1, y1, x2, y2, cor, largura = 1, tracejado = []) {
  contexto.beginPath();
  contexto.setLineDash(tracejado);
  contexto.moveTo(x1, y1);
  contexto.lineTo(x2, y2);
  contexto.strokeStyle = cor;
  contexto.lineWidth = largura;
  contexto.stroke();
  contexto.setLineDash([]);
}

function desenharVariaveis(passo) {
  const variaveis = passo.variaveis;
  const tipos = passo.tipos;
  const nomes = Object.keys(variaveis);

  if (!nomes.length) {
    desenharTexto("Nenhuma variavel ainda.", obterLarguraCanvas() / 2, obterAlturaCanvas() / 2, {
      color: cores.textoSuave(),
      align: "center",
      size: 13
    });
    return;
  }

  const larguraCelula = 150;
  const alturaCelula = 84;
  const espacamento = 20;
  const colunas = Math.min(4, Math.max(1, Math.floor((obterLarguraCanvas() - 40) / (larguraCelula + espacamento))));
  const linhas = Math.ceil(nomes.length / colunas);
  const origemX = (obterLarguraCanvas() - (colunas * (larguraCelula + espacamento) - espacamento)) / 2;
  const origemY = (obterAlturaCanvas() - (linhas * (alturaCelula + espacamento) - espacamento)) / 2;

  nomes.forEach((nome, indice) => {
    const linha = Math.floor(indice / colunas);
    const coluna = indice % colunas;
    const x = origemX + coluna * (larguraCelula + espacamento);
    const y = origemY + linha * (alturaCelula + espacamento);
    const alterado = nome === passo.alterado;

    if (alterado) {
      contexto.save();
      contexto.shadowColor = cores.destaque();
      contexto.shadowBlur = 18;
      desenharRetanguloArredondado(x, y, larguraCelula, alturaCelula, 8, "rgba(124, 92, 252, 0.1)", cores.destaque(), 1.5);
      contexto.restore();
    } else {
      desenharRetanguloArredondado(x, y, larguraCelula, alturaCelula, 8, cores.superficie(), cores.bordaSecundaria());
    }

    const tipo = tipos[nome] || "int";
    contexto.font = "500 10px JetBrains Mono";
    const larguraTipo = contexto.measureText(tipo).width + 12;

    desenharRetanguloArredondado(x + 10, y + 10, larguraTipo, 16, 3, "rgba(124, 92, 252, 0.12)", "rgba(124, 92, 252, 0.28)");
    desenharTexto(tipo, x + 16, y + 22, { size: 10, color: cores.destaqueSecundario() });
    desenharTexto(nome, x + 10, y + 46, {
      size: 14,
      color: alterado ? cores.destaqueSecundario() : cores.texto(),
      weight: "600"
    });

    const valor = String(variaveis[nome]);
    contexto.font = "700 18px JetBrains Mono";
    const larguraValor = contexto.measureText(valor).width + 22;

    desenharRetanguloArredondado(
      x + 10,
      y + 54,
      larguraValor,
      22,
      4,
      alterado ? "rgba(34, 197, 94, 0.13)" : "rgba(96, 165, 250, 0.1)",
      alterado ? "rgba(34, 197, 94, 0.35)" : "rgba(96, 165, 250, 0.25)"
    );

    desenharTexto(valor, x + 10 + larguraValor / 2, y + 69, {
      size: 14,
      color: alterado ? cores.verdeSuave() : cores.azul(),
      weight: "700",
      align: "center"
    });

    desenharTexto(obterEnderecoMemoria(nome), x + larguraCelula - 8, y + alturaCelula - 8, {
      size: 8,
      color: cores.textoSuave(),
      align: "right"
    });
  });

  desenharTexto("ESTADO DA MEMORIA", 16, 22, {
    size: 9,
    color: cores.textoSuave(),
    weight: "700",
    mono: false
  });
}

function desenharFluxo(passo) {
  const codigo = document.getElementById("entradaCodigo").value.split("\n");
  if (!codigo.length) {
    return;
  }

  const larguraCaixa = 260;
  const alturaCaixa = 38;
  const espacamento = 22;
  const linhasVisiveis = codigo.filter((linha) => linha.trim());
  const alturaTotal = linhasVisiveis.length * (alturaCaixa + espacamento) - espacamento;
  let origemY = (obterAlturaCanvas() - alturaTotal) / 2;
  const origemX = (obterLarguraCanvas() - larguraCaixa) / 2;

  linhasVisiveis.forEach((linhaBruta, indiceVisivel) => {
    const linhaLimpa = linhaBruta.trim();
    const indiceOriginal = codigo.findIndex((linha) => linha.trim() === linhaLimpa);
    const ativa = passo.linha === indiceOriginal;
    const passada = passo.linha > indiceOriginal;

    if (indiceVisivel > 0) {
      desenharLinha(origemX + larguraCaixa / 2, origemY - espacamento, origemX + larguraCaixa / 2, origemY, passada ? cores.destaque() : cores.borda(), passada ? 1.5 : 1);
      contexto.beginPath();
      contexto.fillStyle = passada ? cores.destaque() : cores.borda();
      contexto.moveTo(origemX + larguraCaixa / 2, origemY);
      contexto.lineTo(origemX + larguraCaixa / 2 - 4, origemY - 7);
      contexto.lineTo(origemX + larguraCaixa / 2 + 4, origemY - 7);
      contexto.fill();
    }

    const fundo = ativa ? "rgba(124, 92, 252, 0.14)" : passada ? "rgba(124, 92, 252, 0.05)" : cores.superficie();
    const borda = ativa ? cores.destaque() : passada ? "rgba(124, 92, 252, 0.35)" : cores.borda();

    if (ativa) {
      contexto.save();
      contexto.shadowColor = cores.destaque();
      contexto.shadowBlur = 14;
    }

    desenharRetanguloArredondado(origemX, origemY, larguraCaixa, alturaCaixa, /^(if|for|while|else)/.test(linhaLimpa) ? 18 : 6, fundo, borda, ativa ? 1.5 : 1);

    if (ativa) {
      contexto.restore();
    }

    desenharTexto(linhaLimpa.slice(0, 34), origemX + 12, origemY + alturaCaixa / 2 + 5, {
      size: 11,
      color: ativa ? cores.destaqueSecundario() : passada ? cores.textoSecundario() : cores.textoSuave()
    });

    desenharTexto(String(indiceOriginal + 1), origemX + larguraCaixa - 10, origemY + alturaCaixa / 2 + 5, {
      size: 9,
      color: cores.textoSuave(),
      align: "right"
    });

    origemY += alturaCaixa + espacamento;
  });

  desenharTexto("FLUXO DE EXECUCAO", 16, 22, {
    size: 9,
    color: cores.textoSuave(),
    weight: "700",
    mono: false
  });
}

function desenharPilha(passo) {
  const variaveis = passo.variaveis;
  const tipos = passo.tipos;
  const nomes = Object.keys(variaveis).reverse();
  const alturaCelula = 48;
  const larguraCelula = 300;
  const espacamento = 4;
  const origemX = (obterLarguraCanvas() - larguraCelula) / 2;
  const baseY = obterAlturaCanvas() - 56;

  desenharRetanguloArredondado(origemX - 8, baseY + 6, larguraCelula + 16, 14, 4, cores.superficie(), cores.bordaSecundaria());
  desenharTexto("BASE DA PILHA  0x7fff0000", origemX + larguraCelula / 2, baseY + 16, {
    size: 9,
    color: cores.textoSuave(),
    align: "center"
  });

  nomes.forEach((nome, indice) => {
    const y = baseY - (indice + 1) * (alturaCelula + espacamento);
    const topo = indice === 0;
    const alterado = nome === passo.alterado;

    desenharRetanguloArredondado(
      origemX,
      y,
      larguraCelula,
      alturaCelula,
      6,
      alterado ? "rgba(124, 92, 252, 0.1)" : topo ? "rgba(124, 92, 252, 0.05)" : cores.superficie(),
      alterado ? cores.destaque() : topo ? cores.bordaSecundaria() : cores.borda(),
      alterado ? 1.5 : 1
    );

    const tipo = tipos[nome] || "int";
    contexto.font = "500 10px JetBrains Mono";
    const larguraTipo = contexto.measureText(tipo).width + 10;

    desenharRetanguloArredondado(origemX + 10, y + 10, larguraTipo, 16, 3, "rgba(124, 92, 252, 0.1)", "rgba(124, 92, 252, 0.25)");
    desenharTexto(tipo, origemX + 15, y + 22, { size: 10, color: cores.destaqueSecundario() });
    desenharTexto(nome, origemX + larguraTipo + 20, y + 22, { size: 12, color: cores.texto(), weight: "600" });
    desenharTexto(String(variaveis[nome]), origemX + larguraCelula - 12, y + alturaCelula / 2 + 6, {
      size: 16,
      color: alterado ? cores.verdeSuave() : cores.azul(),
      weight: "700",
      align: "right"
    });
    desenharTexto(obterEnderecoMemoria(nome), origemX + larguraCelula - 10, y + alturaCelula - 8, {
      size: 8,
      color: cores.textoSuave(),
      align: "right"
    });

    if (topo) {
      desenharTexto("<- topo", origemX + larguraCelula + 10, y + alturaCelula / 2 + 5, {
        size: 9,
        color: cores.destaqueSecundario()
      });
    }
  });

  desenharTexto("PILHA DE CHAMADAS  -  main()", 16, 22, {
    size: 9,
    color: cores.textoSuave(),
    weight: "700",
    mono: false
  });
}

function desenharArrays(passo) {
  const arrays = passo.arrays || {};
  const nomesArrays = Object.keys(arrays);

  if (!nomesArrays.length) {
    desenharTexto("Nenhum array detectado.", obterLarguraCanvas() / 2, obterAlturaCanvas() / 2, {
      color: cores.textoSuave(),
      align: "center",
      size: 13
    });
    desenharTexto("Declare: int arr[] = {1, 2, 3};", obterLarguraCanvas() / 2, obterAlturaCanvas() / 2 + 22, {
      color: cores.textoSuave(),
      align: "center",
      size: 10
    });
    return;
  }

  let origemY = 60;

  nomesArrays.forEach((nome) => {
    const array = arrays[nome];
    const larguraCelula = Math.min(72, Math.max(44, (obterLarguraCanvas() - 60) / Math.max(array.length, 1)));
    const alturaCelula = 60;
    const larguraTotal = array.length * larguraCelula;
    const origemX = (obterLarguraCanvas() - larguraTotal) / 2;

    desenharTexto(nome + "[ ]", origemX, origemY - 10, {
      size: 12,
      color: cores.destaqueSecundario(),
      weight: "700"
    });

    array.forEach((valor, indice) => {
      const x = origemX + indice * larguraCelula;
      const alterado = indice === passo.indiceAlterado && nome === passo.alterado;

      desenharRetanguloArredondado(
        x,
        origemY,
        larguraCelula - 4,
        alturaCelula,
        6,
        alterado ? "rgba(124, 92, 252, 0.14)" : cores.superficie(),
        alterado ? cores.destaque() : cores.bordaSecundaria(),
        alterado ? 1.5 : 1
      );

      desenharTexto(String(indice), x + larguraCelula / 2 - 2, origemY + 13, {
        size: 9,
        color: cores.textoSuave(),
        align: "center"
      });

      desenharTexto(String(valor), x + larguraCelula / 2 - 2, origemY + 38, {
        size: 15,
        color: alterado ? cores.verdeSuave() : cores.azul(),
        weight: "700",
        align: "center"
      });

      desenharTexto(obterEnderecoMemoria(nome + "_" + indice), x + larguraCelula / 2 - 2, origemY + alturaCelula - 6, {
        size: 7,
        color: cores.textoSuave(),
        align: "center"
      });
    });

    origemY += alturaCelula + 48;
  });

  desenharTexto("ARRAYS", 16, 22, {
    size: 9,
    color: cores.textoSuave(),
    weight: "700",
    mono: false
  });
}

function renderizarCanvas(passo) {
  limparCanvas();

  contexto.strokeStyle = temaClaro ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.025)";
  contexto.lineWidth = 1;

  const grade = 36;

  for (let x = 0; x < obterLarguraCanvas(); x += grade) {
    contexto.beginPath();
    contexto.moveTo(x, 0);
    contexto.lineTo(x, obterAlturaCanvas());
    contexto.stroke();
  }

  for (let y = 0; y < obterAlturaCanvas(); y += grade) {
    contexto.beginPath();
    contexto.moveTo(0, y);
    contexto.lineTo(obterLarguraCanvas(), y);
    contexto.stroke();
  }

  if (modoVisualizacao === "variaveis") {
    desenharVariaveis(passo);
  } else if (modoVisualizacao === "fluxo") {
    desenharFluxo(passo);
  } else if (modoVisualizacao === "pilha") {
    desenharPilha(passo);
  } else if (modoVisualizacao === "arrays") {
    desenharArrays(passo);
  }
}

function escaparHtml(valor) {
  return String(valor).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.getElementById("entradaCodigo").value = CODIGO_PADRAO;
sincronizarEditor();
window.addEventListener("resize", redimensionarCanvas);
setTimeout(redimensionarCanvas, 50);
